import assert from "node:assert/strict";
import test from "node:test";
import { INVOICE_CASES, INVOICE_FIELDS, type Invoice } from "../src/lib/extraction/dataset";
import { createExperiment, makeRow, parseExperiment, summarize } from "../src/lib/extraction/experiment";
import { runOllama } from "../src/lib/extraction/ollama";
import { extractBaseline, scoreInvoice, validateInvoice } from "../src/lib/extraction/scoring";
import { tokenize, countTokens } from "../src/lib/tokenizer";
import { computeBestValue } from "../src/lib/comparison-scoring";

test("every reference answer satisfies schema and exact grading", () => {
  assert.equal(new Set(INVOICE_CASES.map(c=>c.id)).size, INVOICE_CASES.length);
  for (const item of INVOICE_CASES) {
    assert.deepEqual(validateInvoice(item.expected), []);
    assert.equal(scoreInvoice(JSON.stringify(item.expected), item.expected).pass,true);
  }
});

test("grading distinguishes invented, missing and incorrect fields", () => {
  const item=INVOICE_CASES[2];
  const raw=JSON.stringify({...item.expected, dueDate:"2026-04-01", vendor:null, total:76});
  const verdict=scoreInvoice(raw,item.expected);
  assert.equal(verdict.pass,false);
  assert.equal(verdict.fields.find(f=>f.field==="dueDate")?.kind,"invented");
  assert.equal(verdict.fields.find(f=>f.field==="vendor")?.kind,"missing");
  assert.equal(verdict.fields.find(f=>f.field==="total")?.kind,"incorrect");
  assert.equal(verdict.fieldAccuracy,3/INVOICE_FIELDS.length);
});

test("malformed JSON, schema drift, impossible dates and truncation fail", () => {
  const expected=INVOICE_CASES[0].expected;
  for(const response of ["```json\n{}\n```", "null", "[]", JSON.stringify({...expected, extra:true}), JSON.stringify({...expected,total:"1250.50"}), JSON.stringify({...expected,invoiceDate:"2026-02-30"})]) assert.equal(scoreInvoice(response,expected).pass,false);
  assert.equal(scoreInvoice(JSON.stringify(expected),expected,false).pass,false);
  assert.equal(scoreInvoice('{"vendor":',expected).jsonValid,false);
});

test("money grading does not silently round fractional cents",()=> {
  const expected={...INVOICE_CASES[0].expected,total:1};
  assert.equal(scoreInvoice(JSON.stringify({...expected,total:1.004}),expected).pass,false);
  assert.equal(scoreInvoice(JSON.stringify({...expected,total:1.004}),expected).schemaValid,false);
});

test("baseline parses labels without manufacturing missing values or resolving ambiguity",()=> {
  assert.deepEqual(extractBaseline(INVOICE_CASES[0].text),INVOICE_CASES[0].expected);
  assert.equal(extractBaseline(INVOICE_CASES[8].text).invoiceDate,null);
  assert.equal(extractBaseline(INVOICE_CASES[9].text).total,null);
  const unrelated=extractBaseline("Vendor: New Vendor\nTotal: 3.50");
  assert.deepEqual(unrelated,{vendor:"New Vendor",invoiceNumber:null,invoiceDate:null,dueDate:null,currency:null,total:3.5});
});

test("request failures count against pass rate and coverage, not answer field accuracy",async()=> {
  const run=await createExperiment(["baseline"],"plain",1);
  run.rows.push(makeRow(INVOICE_CASES[0],"baseline",0,{response:JSON.stringify(INVOICE_CASES[0].expected),latencyMs:10,inputTokens:null,outputTokens:null,complete:true,finishReason:"rules",modelDigest:null}));
  run.rows.push(makeRow(INVOICE_CASES[1],"baseline",0,{response:"",latencyMs:50,inputTokens:null,outputTokens:null,complete:false,finishReason:"error",modelDigest:null,error:"unavailable"}));
  const summary=summarize(run)[0];
  assert.equal(summary.passRate,.5);assert.equal(summary.fieldAccuracy,1);assert.equal(summary.coverage,1/12);assert.equal(summary.errors,1);assert.equal(summary.p95Ms,10);
});

test("import recomputes verdicts and rejects duplicate, missing, or incompatible evidence",async()=> {
  const run=await createExperiment(["baseline"],"schema",1);
  run.rows.push(makeRow(INVOICE_CASES[0],"baseline",0,{response:"{}",latencyMs:1,inputTokens:null,outputTokens:null,complete:true,finishReason:"rules",modelDigest:null}));
  run.rows[0].verdict!.pass=true;
  assert.equal((await parseExperiment(JSON.stringify(run))).rows[0].verdict!.pass,false);
  const reordered = { ...run, config: Object.fromEntries(Object.entries(run.config).reverse()) };
  assert.equal((await parseExperiment(JSON.stringify(reordered))).rows.length,1);
  await assert.rejects(parseExperiment(JSON.stringify({...run,rows:[run.rows[0],run.rows[0]]})),/duplicate/);
  await assert.rejects(parseExperiment(JSON.stringify({...run,status:"completed"})),/missing results/);
  await assert.rejects(parseExperiment(JSON.stringify({...run,datasetHash:"tampered"})),/different dataset/);
});

test("run fingerprint is stable and configurations are bounded",async()=> {
  assert.equal((await createExperiment(["baseline"],"plain",1)).datasetHash,(await createExperiment(["baseline"],"schema",2)).datasetHash);
  await assert.rejects(createExperiment([],"plain",1));
  await assert.rejects(createExperiment(["baseline","baseline"],"plain",1));
  await assert.rejects(createExperiment(["baseline"],"plain",6));
});

test("Ollama requests use fixed loopback, bounded settings, and no reference answers",async()=> {
  let request: Record<string,unknown>={};
  const fetcher: typeof fetch=async(input, init)=> {
    assert.ok(String(input).startsWith("http://127.0.0.1:11434/api/"));
    if(String(input).endsWith("tags"))return Response.json({models:[{name:"llama3.2:3b",digest:"sha256:test"}]});
    request=JSON.parse(String(init?.body));
    return Response.json({message:{content:JSON.stringify(INVOICE_CASES[0].expected)},done:true,done_reason:"stop",prompt_eval_count:100,eval_count:80});
  };
  const result=await runOllama("llama3.2:3b","Invoice Number: unseen", "schema",fetcher);
  assert.equal(result.complete,true);assert.equal(result.modelDigest,"sha256:test");assert.equal(result.inputTokens,100);
  assert.equal(request.stream,false);assert.ok(request.format);
  assert.deepEqual(request.options,{temperature:0,seed:42,num_predict:512,num_ctx:4096});
  assert.ok(!JSON.stringify(request).includes("Northstar"));
});

test("Ollama length limits remain visible and missing models never trigger downloads",async()=> {
  const truncated:typeof fetch=async(input)=>String(input).endsWith("tags") ? Response.json({models:[{name:"qwen2.5:3b",digest:"test"}]}) : Response.json({message:{content:"{}"},done:true,done_reason:"length",eval_count:512});
  const result=await runOllama("qwen2.5:3b","invoice","plain",truncated);
  assert.equal(result.complete,false);assert.equal(result.outputTokens,512);
  const missing:typeof fetch=async(input)=>{assert.ok(String(input).endsWith("tags"));return Response.json({models:[]});};
  await assert.rejects(runOllama("llama3.2:3b","invoice","plain",missing),/Install/);
});

test("token display preserves multilingual text and literal special-token strings",()=> {
  for(const input of ["😊", "漢字", "Café 👩🏽‍💻 مرحبا", "literal �", "<|endoftext|>"]) {
    const chips=tokenize(input);
    assert.equal(chips.map(c=>c.text).join(""),input);
    assert.equal(chips.reduce((s,c)=>s+c.ids.length,0),countTokens(input));
  }
});

test("value selection rejects poor and incomplete answers and permits zero API cost",()=> {
  assert.equal(computeBestValue({"gpt-4o-mini":{costUsd:0},"claude-sonnet-4-6":{costUsd:1}},{"gpt-4o-mini":2,"claude-sonnet-4-6":3}),null);
  assert.equal(computeBestValue({"gpt-4o-mini":{costUsd:0},"claude-sonnet-4-6":{costUsd:1}},{"gpt-4o-mini":8,"claude-sonnet-4-6":9}),"gpt-4o-mini");
  assert.equal(computeBestValue({"gpt-4o-mini":{costUsd:0,complete:false}},{"gpt-4o-mini":9}),null);
});

// Compile-time assurance that a consumer cannot use arbitrary schema fields.
const shape: Invoice=INVOICE_CASES[0].expected;
assert.ok(shape.vendor);

import assert from "node:assert/strict";
import test from "node:test";
import { runHosted } from "../src/lib/extraction/hosted";
import { createExperiment, makeRow, parseExperiment, summarize } from "../src/lib/extraction/experiment";
import { customCandidate, planCost, resolveCandidate } from "../src/lib/extraction/models";
import { INVOICE_CASES } from "../src/lib/extraction/dataset";
import { getApiKeys, saveApiKeys, remembersKeys, STORAGE_KEY } from "../src/lib/api-keys";

const key = "synthetic-test-secret-not-a-real-key";
const text = INVOICE_CASES[0].text;
const answer = JSON.stringify(INVOICE_CASES[0].expected);

test("OpenAI uses the selected model, strict JSON schema, bounded output, and reports usage", async()=> {
  let calls=0;
  const mock: typeof fetch=async(url,init)=> {
    calls++; assert.equal(url,"https://api.openai.com/v1/chat/completions");
    assert.equal(new Headers(init?.headers).get("Authorization"),`Bearer ${key}`);
    const body=JSON.parse(String(init?.body)); assert.equal(body.model,"gpt-5.6-terra"); assert.equal(body.max_completion_tokens,512); assert.equal(body.reasoning_effort,"none"); assert.equal(body.store,false); assert.equal(body.response_format.json_schema.strict,true);
    assert.equal(body.messages[1].content,"Invoice document:\n"+text);
    assert.equal(init?.redirect,"error");
    return Response.json({model:"gpt-5.6-terra-snapshot",choices:[{message:{content:answer},finish_reason:"stop"}],usage:{prompt_tokens:100,completion_tokens:50}});
  };
  const result=await runHosted("openai:gpt-5.6-terra",text,"schema",key,mock);
  assert.equal(calls,1); assert.equal(result.complete,true); assert.equal(result.hosted?.actualModel,"gpt-5.6-terra-snapshot"); assert.equal(result.hosted?.estimatedCostUsd,.0008);
});

test("Anthropic combines text blocks and uses its own structured output format",async()=> {
  const mock:typeof fetch=async(url,init)=> {
    assert.equal(url,"https://api.anthropic.com/v1/messages");assert.equal(new Headers(init?.headers).get("x-api-key"),key);
    const body=JSON.parse(String(init?.body));assert.equal(body.max_tokens,512);assert.equal(body.output_config.format.type,"json_schema");assert.ok(!JSON.stringify(body.output_config).includes("minimum"));
    return Response.json({model:"claude-haiku-4-5-20251001",content:[{type:"text",text:answer.slice(0,20)},{type:"text",text:answer.slice(20)}],stop_reason:"end_turn",usage:{input_tokens:100,output_tokens:50}});
  };
  const result=await runHosted("anthropic:claude-haiku-4-5",text,"schema",key,mock);
  assert.equal(result.response,answer);assert.equal(result.complete,true);assert.equal(result.hosted?.estimatedCostUsd,.00035);
});

test("Gemini keeps the key in a header and accounts for thinking tokens",async()=> {
  const mock:typeof fetch=async(url,init)=> {
    assert.equal(url,"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent");assert.ok(!String(url).includes(key));assert.equal(new Headers(init?.headers).get("x-goog-api-key"),key);
    const body=JSON.parse(String(init?.body));assert.equal(body.generationConfig.maxOutputTokens,512);assert.ok(body.generationConfig.responseJsonSchema);assert.equal(body.generationConfig.thinkingConfig.thinkingBudget,0);
    return Response.json({modelVersion:"gemini-2.5-flash",candidates:[{content:{parts:[{thought:true,text:"hidden"},{text:answer}]},finishReason:"STOP"}],usageMetadata:{promptTokenCount:100,candidatesTokenCount:40,thoughtsTokenCount:10}});
  };
  const result=await runHosted("gemini:gemini-2.5-flash",text,"schema",key,mock);
  assert.equal(result.response,answer);assert.equal(result.outputTokens,50);assert.equal(result.complete,true);assert.equal(result.hosted?.estimatedCostUsd,.000155);
});

test("custom IDs use provider defaults, unknown pricing, and no hidden model fallback",async()=> {
  const id=customCandidate("openai","my-text-model");
  const mock:typeof fetch=async(_url,init)=> {
    const body=JSON.parse(String(init?.body));assert.equal(body.model,"my-text-model");assert.equal(body.temperature,undefined);assert.equal(body.reasoning_effort,undefined);assert.equal(body.response_format,undefined);
    return Response.json({choices:[{message:{content:answer},finish_reason:"stop"}],usage:{prompt_tokens:100,completion_tokens:50}});
  };
  assert.equal((await runHosted(id,text,"plain",key,mock)).hosted?.estimatedCostUsd,null);
  for (const model of ["https://example.com", "../../secrets", "sk-secret"]) assert.throws(()=>customCandidate("openai",model));
  assert.equal(resolveCandidate("custom:other:model"),undefined);
});

test("errors, refusals, empty and truncated responses remain distinct without secret leakage",async()=> {
  let calls=0;
  const errorMock:typeof fetch=async()=>{calls++;return Response.json({error:{message:key}},{status:429});};
  const failed=await runHosted("openai:gpt-5.6-terra",text,"plain",key,errorMock);
  assert.equal(calls,1);assert.match(failed.error!,/quota/);assert.ok(!JSON.stringify(failed).includes(key));
  const thrown:typeof fetch=async()=>{throw new Error(key);};
  assert.ok(!JSON.stringify(await runHosted("openai:gpt-5.6-terra",text,"plain",key,thrown)).includes(key));
  for (const finish of ["length","content_filter"]) {
    const mock:typeof fetch=async()=>Response.json({choices:[{message:{content:answer},finish_reason:finish}],usage:{prompt_tokens:100,completion_tokens:512}});
    const result=await runHosted("openai:gpt-5.6-terra",text,"plain",key,mock);assert.equal(result.complete,false);assert.equal(result.outputTokens,512);assert.ok(result.hosted!.estimatedCostUsd!>0);
  }
  const echoed:typeof fetch=async()=>Response.json({choices:[{message:{content:key},finish_reason:"stop"}]});
  assert.ok(!JSON.stringify(await runHosted("openai:gpt-5.6-terra",text,"plain",key,echoed)).includes(key));
});

test("runs preserve hosted provenance and recompute estimated cost on import, never credentials",async()=> {
  const mock:typeof fetch=async()=>Response.json({choices:[{message:{content:answer},finish_reason:"stop"}],usage:{prompt_tokens:100,completion_tokens:50}});
  const generation=await runHosted("openai:gpt-5.6-terra",text,"plain",key,mock);
  const run=await createExperiment(["openai:gpt-5.6-terra"],"plain",1);
  run.rows.push(makeRow(INVOICE_CASES[0],"openai:gpt-5.6-terra",0,generation));
  const json=JSON.stringify(run);assert.ok(!json.includes(key));
  run.rows[0].hosted!.estimatedCostUsd=0;
  const imported=await parseExperiment(JSON.stringify(run));assert.equal(imported.rows[0].hosted?.estimatedCostUsd,.0008);assert.equal(summarize(imported)[0].estimatedCostUsd,.0008);
});

test("planning costs scale with repeats and mark custom prices unknown",()=> {
  assert.equal(planCost(["baseline","llama3.2:3b"],"plain",1).usd,0);
  const one=planCost(["openai:gpt-5.6-terra"],"schema",1);
  assert.ok(Math.abs(planCost(["openai:gpt-5.6-terra"],"schema",2).usd-one.usd*2)<1e-12);
  assert.equal(planCost([customCandidate("gemini","custom-model")],"plain",1).unknown,true);
});

test("API keys stay in page memory by default; persistence requires explicit opt-in",()=> {
  const previousWindow=Object.getOwnPropertyDescriptor(globalThis,"window");const previousStorage=Object.getOwnPropertyDescriptor(globalThis,"localStorage");
  const values=new Map<string,string>();const storage={getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>values.set(k,v),removeItem:(k:string)=>values.delete(k)};
  Object.defineProperty(globalThis,"window",{value:{},configurable:true});Object.defineProperty(globalThis,"localStorage",{value:storage,configurable:true});
  try {
    saveApiKeys({openai:key},false);assert.equal(getApiKeys().openai,key);assert.equal(storage.getItem(STORAGE_KEY),null);assert.equal(remembersKeys(),false);
    saveApiKeys({openai:key},true);assert.equal(remembersKeys(),true);assert.ok(storage.getItem(STORAGE_KEY)?.includes(key));
    saveApiKeys({},false);assert.equal(storage.getItem(STORAGE_KEY),null);assert.deepEqual(getApiKeys(),{});
  } finally { if(previousWindow)Object.defineProperty(globalThis,"window",previousWindow);else Reflect.deleteProperty(globalThis,"window");if(previousStorage)Object.defineProperty(globalThis,"localStorage",previousStorage);else Reflect.deleteProperty(globalThis,"localStorage"); }
});

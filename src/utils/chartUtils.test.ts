import assert from "node:assert/strict";
import { test } from "node:test";
import {
  groupByPlatform,
  extractTechTags,
  groupByLocation,
} from "./chartUtils";
import type { BaseJob } from "../providers/types";

const job = (overrides: Partial<BaseJob>): BaseJob => ({
  id: "test0001",
  title: "",
  company: "",
  location: "",
  salary: "",
  url: "",
  page: 1,
  source: "104",
  ...overrides,
});

// ── groupByPlatform ───────────────────────────────────────────
test("groupByPlatform 空陣列回傳三平台皆為 0", () => {
  const result = groupByPlatform([]);
  assert.deepEqual(result, [
    { platform: "104", count: 0 },
    { platform: "1111", count: 0 },
    { platform: "yourator", count: 0 },
  ]);
});

test("groupByPlatform 計數正確且順序固定", () => {
  const jobs = [
    job({ source: "104" }),
    job({ source: "104" }),
    job({ source: "1111" }),
  ];
  const result = groupByPlatform(jobs);
  assert.equal(result[0].platform, "104");
  assert.equal(result[0].count, 2);
  assert.equal(result[1].platform, "1111");
  assert.equal(result[1].count, 1);
  assert.equal(result[2].platform, "yourator");
  assert.equal(result[2].count, 0);
});

// ── extractTechTags ───────────────────────────────────────────
test("extractTechTags 空陣列回傳空陣列", () => {
  assert.deepEqual(extractTechTags([]), []);
});

test("extractTechTags 大小寫正規化 vue/Vue/VUE 計為同一", () => {
  const jobs = [
    job({ title: "vue 工程師" }),
    job({ title: "Vue.js Developer" }),
    job({ title: "VUE 前端" }),
  ];
  const result = extractTechTags(jobs);
  assert.equal(result[0].tag, "Vue");
  assert.equal(result[0].count, 3);
});

test("extractTechTags 無已知關鍵字時「其他」等於職缺總數", () => {
  const jobs = [job({ title: "業務助理" }), job({ title: "後端工程師" })];
  const result = extractTechTags(jobs);
  assert.equal(result.length, 1);
  assert.equal(result[0].tag, "其他");
  assert.equal(result[0].count, 2);
});

test("extractTechTags Top3 截取且剩餘歸入「其他」", () => {
  const jobs = [
    ...Array(10).fill(null).map(() => job({ title: "Vue 工程師" })),
    ...Array(6).fill(null).map(() => job({ title: "React 工程師" })),
    ...Array(4).fill(null).map(() => job({ title: "Angular 工程師" })),
    ...Array(2).fill(null).map(() => job({ title: "TypeScript 工程師" })),
  ];
  const result = extractTechTags(jobs);
  assert.equal(result.length, 4);
  assert.equal(result[0].tag, "Vue");
  assert.equal(result[0].count, 10);
  assert.equal(result[1].tag, "React");
  assert.equal(result[1].count, 6);
  assert.equal(result[2].tag, "Angular");
  assert.equal(result[2].count, 4);
  assert.equal(result[3].tag, "其他");
  assert.equal(result[3].count, 2);
});

test("extractTechTags 恰好三種技術無殘餘時「其他」省略", () => {
  const jobs = [
    ...Array(5).fill(null).map(() => job({ title: "Vue 工程師" })),
    ...Array(3).fill(null).map(() => job({ title: "React 工程師" })),
    ...Array(2).fill(null).map(() => job({ title: "Angular 工程師" })),
  ];
  const result = extractTechTags(jobs);
  assert.equal(result.length, 3);
  assert.ok(result.every((r) => r.tag !== "其他"));
});

// ── groupByLocation ───────────────────────────────────────────
test("groupByLocation 空陣列回傳空陣列", () => {
  assert.deepEqual(groupByLocation([]), []);
});

test("groupByLocation 含行政區地點正規化", () => {
  const jobs = [
    job({ location: "台北市信義區" }),
    job({ location: "台北市中山區" }),
    job({ location: "高雄市" }),
  ];
  const result = groupByLocation(jobs);
  const taipei = result.find((r) => r.location === "台北市");
  assert.ok(taipei);
  assert.equal(taipei.count, 2);
});

test("groupByLocation 空字串歸為「不明」且排末尾", () => {
  const jobs = [
    job({ location: "" }),
    job({ location: "台北市" }),
    job({ location: "" }),
  ];
  const result = groupByLocation(jobs);
  assert.equal(result[result.length - 1].location, "不明");
  assert.equal(result[result.length - 1].count, 2);
});

test("groupByLocation 短地點字串（< 3 字元）維持原值", () => {
  const jobs = [job({ location: "台北" })];
  const result = groupByLocation(jobs);
  assert.equal(result[0].location, "台北");
});

test("groupByLocation「不明」計數最大時仍在末尾", () => {
  const jobs = [
    ...Array(5).fill(null).map(() => job({ location: "" })),
    job({ location: "台北市" }),
  ];
  const result = groupByLocation(jobs);
  assert.equal(result[result.length - 1].location, "不明");
  assert.equal(result[result.length - 1].count, 5);
});

test("groupByLocation 全部 location 為空字串時僅回傳「不明」一筆", () => {
  const jobs = [
    job({ location: "" }),
    job({ location: "" }),
    job({ location: "" }),
  ];
  const result = groupByLocation(jobs);
  assert.equal(result.length, 1);
  assert.equal(result[0].location, "不明");
  assert.equal(result[0].count, 3);
});

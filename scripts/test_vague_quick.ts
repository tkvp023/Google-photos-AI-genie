import { vagueCheck, checkTimeAnchor, checkPersonAnchor, checkLocationAnchor } from "../src/lib/vagueCheck";
import { evaluateTrigger } from "../src/lib/coachEngine";
import { search } from "../src/lib/search";

const q = "a couple of summers ago, with friends";
const v = vagueCheck(q);
console.log("vagueCheck:", v);
console.log("timeAnchor:", checkTimeAnchor(q));
console.log("personAnchor:", checkPersonAnchor(q));
console.log("locAnchor:", checkLocationAnchor(q));

const s = search(q);
console.log("search count_strong:", s.count_strong, "results length:", s.results.length);
const trig = evaluateTrigger({
  query: q,
  isVague: v.isVague,
  countStrong: s.count_strong,
  countTotal: s.count_total,
  mode: "B"
});
console.log("evaluateTrigger:", trig.shouldTrigger, trig.blockedReason, trig.candidateCount);

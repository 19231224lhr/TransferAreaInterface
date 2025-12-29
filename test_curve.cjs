// 测试 PublicKeyNew 字段名问题

const crypto = require('crypto');

// 场景 1: 后端发送的数据（CurveName）
const backendPublicKey = {
  CurveName: "P256",
  X: "79166714865309825846907087132847778751150603278544164447482729895890609575661",
  Y: "1033152861007039415493655740783085086937971009513934179604093231650201841533"
};

// 场景 2: 如果前端错误地使用 Curve 而不是 CurveName
const frontendWrongPublicKey = {
  Curve: "P256",  // ⚠️ 错误的字段名
  X: "79166714865309825846907087132847778751150603278544164447482729895890609575661",
  Y: "1033152861007039415493655740783085086937971009513934179604093231650201841533"
};

// 构造 TXOutput
function buildTXOutput(pubKey) {
  return {
    ToAddress: "b0b43b638f4bcc0fb941fca7e7b26d15612eb64d",
    ToValue: 90,
    ToGuarGroupID: "10000000",
    ToPublicKey: pubKey,
    ToInterest: 0,
    Type: 0,
    ToPeerID: "",
    IsPayForGas: false,
    IsCrossChain: false,
    IsGuarMake: false
  };
}

function serializeAndHash(output) {
  let json = JSON.stringify(output);
  // 把 X/Y 字段的引号去掉
  json = json.replace(/"(X|Y|R|S)":"(\d+)"/g, '"$1":$2');
  const hash = crypto.createHash('sha256').update(json).digest('hex');
  return { json, hash };
}

console.log("========== 场景 1: 正确的字段名 (CurveName) ==========");
const output1 = buildTXOutput(backendPublicKey);
const result1 = serializeAndHash(output1);
console.log("JSON:", result1.json);
console.log("Hash:", result1.hash);

console.log("\n========== 场景 2: 错误的字段名 (Curve) ==========");
const output2 = buildTXOutput(frontendWrongPublicKey);
const result2 = serializeAndHash(output2);
console.log("JSON:", result2.json);
console.log("Hash:", result2.hash);

console.log("\n========== 后端期望的 Hash ==========");
console.log("Hash: 32024a0f58037cfebb6f538476af549712baef94eb4783fc597c3feaf7d851b8");

console.log("\n========== 比较 ==========");
console.log("CurveName 匹配后端:", result1.hash === "32024a0f58037cfebb6f538476af549712baef94eb4783fc597c3feaf7d851b8");
console.log("Curve 匹配后端:", result2.hash === "32024a0f58037cfebb6f538476af549712baef94eb4783fc597c3feaf7d851b8");

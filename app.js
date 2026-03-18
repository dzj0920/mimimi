import config from "./.migpt.js";
import { MiGPT } from "./dist/index.cjs";
// 新增：导入http模块，用于监听端口
import http from "http";

async function main() {
  const client = MiGPT.create(config);
  await client.start();
}

main();

// ==============================================
// 👇 新增：Render 免费端口监听（解决端口扫描报错）
// ==============================================
const PORT = process.env.PORT; // Render 自动分配端口，必须用这个变量
const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("mi-gpt is running\n");
});

server.listen(PORT, () => {
  console.log(`✅ Render 健康检查端口已启动: ${PORT}`);
});

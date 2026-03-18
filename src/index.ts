import { AISpeaker, AISpeakerConfig } from "./services/speaker/ai";
import { MyBot, MyBotConfig } from "./services/bot";
import { getDBInfo, initDB, runWithDB } from "./services/db";
import { kBannerASCII } from "./utils/string";
import { Logger } from "./utils/log";
import { deleteFile } from "./utils/io";
// 新增：引入文件读取模块，用于读取 .mi.json 的 passToken
import fs from "fs";
import path from "path";

export type MiGPTConfig = Omit<MyBotConfig, "speaker"> & {
  speaker: Omit<AISpeakerConfig, "name">;
};

export class MiGPT {
  static instance: MiGPT | null;
  static async reset() {
    MiGPT.instance = null;
    const { dbPath } = getDBInfo();
    await deleteFile(dbPath);
    await deleteFile(".mi.json");
    await deleteFile(".bot.json");
    MiGPT.logger.log("MiGPT 已重置，请使用 MiGPT.create() 重新创建实例。");
  }
  static logger = Logger.create({ tag: "MiGPT" });
  static create(config: MiGPTConfig) {
    // ========== 核心修改 1：移除 userId/password 断言 ==========
    // 原逻辑：const hasAccount = config?.speaker?.userId && config?.speaker?.password;
    // 新逻辑：直接跳过校验，同时读取 .mi.json 确保 passToken 存在
    let passTokenValid = false;
    try {
      const miJsonPath = path.resolve(process.cwd(), ".mi.json");
      const miJson = JSON.parse(fs.readFileSync(miJsonPath, "utf8"));
      passTokenValid = !!miJson.mina?.pass?.passToken && !!miJson.miiot?.pass?.passToken;
    } catch (e) {
      MiGPT.logger.warn("读取 .mi.json 失败，passToken 校验未通过");
    }
    // 断言改为：要么有账号密码，要么有有效 passToken（二选一即可）
    MiGPT.logger.assert(
      passTokenValid || (config?.speaker?.userId && config?.speaker?.password),
      "Missing userId/password OR valid passToken in .mi.json"
    );

    if (MiGPT.instance) {
      MiGPT.logger.log("🚨 注意：MiGPT 是单例，暂不支持多设备、多账号！");
      MiGPT.logger.log(
        "如果需要切换设备或账号，请先使用 MiGPT.reset() 重置实例。"
      );
    } else {
      MiGPT.instance = new MiGPT({ ...config, fromCreate: true });
    }
    return MiGPT.instance;
  }

  ai: MyBot;
  speaker: AISpeaker;
  constructor(config: MiGPTConfig & { fromCreate?: boolean }) {
    MiGPT.logger.assert(
      config.fromCreate,
      "请使用 MiGPT.create() 获取客户端实例！"
    );
    const { speaker, ...myBotConfig } = config;
    this.speaker = new AISpeaker(speaker);
    // ========== 核心修改 2：给 AISpeaker 注入 passToken ==========
    // 读取 .mi.json 的 passToken 并挂载到 speaker 实例上
    try {
      const miJsonPath = path.resolve(process.cwd(), ".mi.json");
      const miJson = JSON.parse(fs.readFileSync(miJsonPath, "utf8"));
      this.speaker.passToken = {
        mina: miJson.mina.pass.passToken,
        miiot: miJson.miiot.pass.passToken
      };
      MiGPT.logger.info("✅ 已从 .mi.json 加载 passToken");
    } catch (e) {
      MiGPT.logger.error("❌ 加载 passToken 失败", e);
    }
    this.ai = new MyBot({
      ...myBotConfig,
      speaker: this.speaker,
    });
  }

  async start() {
    await initDB(this.speaker.debug);
    const main = () => {
      console.log(kBannerASCII);
      return this.ai.run();
    };
    return runWithDB(main);
  }

  async stop() {
    return this.ai.stop();
  }
}

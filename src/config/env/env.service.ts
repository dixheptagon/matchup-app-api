import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ENV } from "./env.config.js";

@Injectable()
export class EnvConfigService {
    constructor(private configService: ConfigService<ENV,true>) {}

    get<T extends keyof ENV>(key: T): ENV[T] {
        return this.configService.get(key, { infer: true });
    }

    get isDevelopment(): boolean {
        return this.configService.get("NODE_ENV") === "development";
    }
}
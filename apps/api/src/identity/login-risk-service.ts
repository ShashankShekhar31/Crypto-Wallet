import { AuthEventRepository } from "./auth-event-repository.js";

const RECENT_FAILURE_WINDOW_MS = 10 * 60 * 1000;
const SUSPICIOUS_FAILURE_THRESHOLD = 3;

export interface EvaluateLoginRiskInput {
  userId: string;
  deviceId: string;
  sourceIpHash?: string | null;
}

export interface LoginRiskResult {
  suspicious: boolean;
  reasons: string[];
}

export class LoginRiskService {
  constructor(private readonly authEventRepository: AuthEventRepository) {}

  async evaluate(input: EvaluateLoginRiskInput): Promise<LoginRiskResult> {
    const reasons: string[] = [];

    const knownDevice = await this.authEventRepository.hasSuccessfulLoginForDevice(
      input.userId,
      input.deviceId,
    );

    if (!knownDevice) {
      reasons.push("new_device");
    }

    if (input.sourceIpHash) {
      const recentFailures = await this.authEventRepository.countRecentFailuresByIp(
        input.sourceIpHash,
        RECENT_FAILURE_WINDOW_MS,
      );

      if (recentFailures >= SUSPICIOUS_FAILURE_THRESHOLD) {
        reasons.push("recent_ip_failures");
      }
    }

    return {
      suspicious: reasons.length > 0,
      reasons,
    };
  }
}

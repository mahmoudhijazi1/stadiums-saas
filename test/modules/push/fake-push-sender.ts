import type { PushResult, PushSender, PushTarget } from "@/modules/push/application/push-sender";
import type { PushSendOptions } from "@/modules/push/domain/push-options";

/** In-memory PushSender: records every send and answers with a scripted result. */
export class FakePushSender implements PushSender {
  readonly sent: { target: PushTarget; payload: string; options: PushSendOptions }[] = [];
  /** Result per endpoint; anything not listed is ok. */
  results = new Map<string, PushResult>();

  async send(target: PushTarget, payload: string, options: PushSendOptions): Promise<PushResult> {
    this.sent.push({ target, payload, options });
    return this.results.get(target.endpoint) ?? { outcome: "ok" };
  }

  endpoints(): string[] {
    return this.sent.map((entry) => entry.target.endpoint);
  }
}

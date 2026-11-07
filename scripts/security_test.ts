import { createHmac } from "crypto";
import { createAdminToken, verifyAdminToken } from "../lib/adminAuth";
import { encryptSecret, decryptSecret } from "../lib/secretBox";
import { getClientIp } from "../lib/rateLimit";

let fails = 0;
const ok = (c: boolean, m: string) => { if (!c) { fails++; console.log("FAIL", m); } else console.log("ok  ", m); };

process.env.NEXTAUTH_SECRET = "x".repeat(40);
process.env.ADMIN_PASSWORD = "pass-one-long-enough";
const t = createAdminToken();
ok(verifyAdminToken(t), "валидный токен принимается");
process.env.ADMIN_PASSWORD = "pass-two-long-enough";
ok(!verifyAdminToken(t), "смена пароля гасит старые сессии");
process.env.ADMIN_PASSWORD = "pass-one-long-enough";
ok(verifyAdminToken(t), "прежний пароль — токен снова валиден");

// подделка токена пустым ключом (старая уязвимость)
const payload = `admin:${Date.now() + 3600_000}`;
const forged = `${payload}.${createHmac("sha256", "").update(payload).digest("hex")}`;
process.env.NEXTAUTH_SECRET = "";
ok(!verifyAdminToken(forged), "подделка пустым секретом не проходит");
let threw = false; try { createAdminToken(); } catch { threw = true; }
ok(threw, "без секрета токен не создаётся");
threw = false; try { encryptSecret("a"); } catch { threw = true; }
ok(threw, "без секрета шифрование не работает");
process.env.NEXTAUTH_SECRET = "short";
ok(!verifyAdminToken(forged), "короткий секрет = отказ");
process.env.NEXTAUTH_SECRET = "y".repeat(40);
ok(decryptSecret(encryptSecret("token-123")) === "token-123", "шифрование туда-обратно");

const req = (h: string) => new Request("http://x", { headers: { "x-forwarded-for": h } });
delete process.env.TRUSTED_PROXY_HOPS;
ok(getClientIp(req("1.1.1.1, 2.2.2.2")) === "1.1.1.1", "по умолчанию — прежнее поведение");
process.env.TRUSTED_PROXY_HOPS = "1";
ok(getClientIp(req("6.6.6.6, 2.2.2.2")) === "2.2.2.2", "hops=1: подделанное первое значение игнорируется");
if (fails) { console.log(fails, "ошибок"); process.exit(1); }
console.log("все проверки пройдены");

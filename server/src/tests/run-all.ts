/**
 * Test Runner Mestre — Executa todas as suítes e fluxos da aplicação Volutis PIBI
 * Uso:
 *   tsx src/tests/run-all.ts            # Executa tudo (suítes + fluxos)
 *   tsx src/tests/run-all.ts --suites   # Apenas suítes de endpoints
 *   tsx src/tests/run-all.ts --flows    # Apenas fluxos E2E integrados
 */

import { runAuthSecuritySuite } from "./suites/01-auth-security.test.js";
import { runMembersMinistriesSuite } from "./suites/02-members-ministries.test.js";
import { runEventsSchedulesSuite } from "./suites/03-events-schedules.test.js";
import { runApplicationsTriagemSuite } from "./suites/04-applications-triagem.test.js";
import { runCheckinGamificationSuite } from "./suites/05-checkin-gamification.test.js";
import { runSongsLiturgySuite } from "./suites/06-songs-liturgy.test.js";
import { runDashboardCommsSuite } from "./suites/07-dashboard-comms.test.js";

import { runOnboardingFlow } from "./flows/flow-onboarding.test.js";
import { runRosterScheduleFlow } from "./flows/flow-roster-schedule.test.js";
import { runSwapRequestFlow } from "./flows/flow-swap-request.test.js";
import { runServiceDayFlow } from "./flows/flow-service-day.test.js";

import { getTestApp } from "./helpers/test-client.js";

const args = process.argv.slice(2);
const runOnlySuites = args.includes("--suites") || args.includes("--suites-only");
const runOnlyFlows = args.includes("--flows") || args.includes("--flows-only");

console.log("\x1b[1m\x1b[34m");
console.log("===============================================================");
console.log(" 🚀 SUÍTE COMPLETA DE TESTES AUTOMATIZADOS — VOLUTIS PIBI API ");
console.log("===============================================================");
console.log("\x1b[0m");

const startTime = Date.now();
let totalPassed = 0;
let totalFailed = 0;

const suites: Array<{ name: string; fn: () => Promise<{ passed: number; failed: number }> }> = [];

if (!runOnlyFlows) {
  suites.push(
    { name: "01. Auth & Segurança (CORS)", fn: runAuthSecuritySuite },
    { name: "02. Membros & Ministérios", fn: runMembersMinistriesSuite },
    { name: "03. Eventos & Escalas", fn: runEventsSchedulesSuite },
    { name: "04. Triagem & Candidaturas", fn: runApplicationsTriagemSuite },
    { name: "05. Check-in & Gamificação", fn: runCheckinGamificationSuite },
    { name: "06. Louvor & Liturgia", fn: runSongsLiturgySuite },
    { name: "07. Dashboard & Comunicação", fn: runDashboardCommsSuite }
  );
}

if (!runOnlySuites) {
  suites.push(
    { name: "FLUXO 01: Onboarding & Triagem (E2E)", fn: runOnboardingFlow },
    { name: "FLUXO 02: Escala & Confirmação (E2E)", fn: runRosterScheduleFlow },
    { name: "FLUXO 03: Troca de Escala (E2E)", fn: runSwapRequestFlow },
    { name: "FLUXO 04: Dia de Culto & Check-in (E2E)", fn: runServiceDayFlow }
  );
}

for (const suite of suites) {
  try {
    const res = await suite.fn();
    totalPassed += res.passed;
    totalFailed += res.failed;
  } catch (err) {
    totalFailed++;
    console.error(`\x1b[31m💥 Erro fatal ao executar ${suite.name}:\x1b[0m`, err);
  }
}

const totalDuration = ((Date.now() - startTime) / 1000).toFixed(2);

console.log("\x1b[1m\x1b[34m");
console.log("===============================================================");
console.log("                   📊 SUMÁRIO GERAL DOS TESTES                 ");
console.log("===============================================================");
console.log(` \x1b[32m✔ Total de Testes com Sucesso:\x1b[0m \x1b[1m${totalPassed}\x1b[0m`);
if (totalFailed > 0) {
  console.log(` \x1b[31m✖ Total de Falhas:\x1b[0m \x1b[1m\x1b[31m${totalFailed}\x1b[0m`);
} else {
  console.log(` \x1b[32m✖ Total de Falhas:\x1b[0m 0`);
}
console.log(` ⏱  Tempo de Execução: ${totalDuration}s`);
console.log("===============================================================\x1b[0m\n");

const app = await getTestApp();
await app.close();

process.exit(totalFailed > 0 ? 1 : 0);

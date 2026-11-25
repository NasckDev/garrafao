/**
 * Publica o Garrafão no portfólio (C:\ale\Myportfolio), seguindo o contrato:
 *  1. build com base /projetos/garrafao/;
 *  2. copia dist -> public/projetos/garrafao/ (substitui a pasta inteira, nada fora dela);
 *  3. copia server/*.ts -> api/_garrafao/ (pasta com "_" não vira Function);
 *  4. cria/atualiza api/nba.ts, que só importa de ./_garrafao/handler.js;
 *  5. roda no portfólio `npx tsc -p tsconfig.api.json` e `npx eslint api`.
 *
 * Uso: npm run publish:portfolio  (PORTFOLIO_DIR muda o destino)
 */
import { execSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PORTFOLIO = process.env.PORTFOLIO_DIR ?? "C:\\ale\\Myportfolio";
const SLUG = "garrafao";
const PUBLIC_DIR = join(PORTFOLIO, "public", "projetos", SLUG);
const API_DIR = join(PORTFOLIO, "api", `_${SLUG}`);
const API_ENTRY = join(PORTFOLIO, "api", "nba.ts");

function run(command: string, cwd: string, env: NodeJS.ProcessEnv = {}) {
  console.log(`\n> ${command}  (${cwd})`);
  execSync(command, { cwd, stdio: "inherit", env: { ...process.env, ...env } });
}

/** Garante que o destino é exatamente a pasta esperada antes de apagar qualquer coisa. */
function assertInside(target: string, parent: string) {
  const rel = relative(parent, target);
  if (!rel || rel.startsWith("..") || rel.includes(":")) throw new Error(`destino fora do esperado: ${target}`);
}

function listFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? listFiles(path) : [path];
  });
}

const ENTRY = `import { handleNba, type NbaRequest, type NbaResponse } from "./_garrafao/handler.js";

/**
 * Proxy de dados públicos da NBA (ESPN) do projeto Garrafão.
 * O código mora no repositório do app (server/) e é copiado para api/_garrafao pelo \`npm run publish:portfolio\`.
 * GET /api/nba?op=<operação>&... (lista fechada de operações, sem URL vinda do cliente).
 */
export default async function handler(request: NbaRequest, response: NbaResponse) {
  return handleNba(request, response);
}
`;

function main() {
  if (!existsSync(join(PORTFOLIO, "api", "visits.ts"))) throw new Error(`portfólio não encontrado em ${PORTFOLIO}`);

  run("npm run build", ROOT, { GARRAFAO_BASE: `/projetos/${SLUG}/` });

  assertInside(PUBLIC_DIR, join(PORTFOLIO, "public", "projetos"));
  rmSync(PUBLIC_DIR, { recursive: true, force: true });
  mkdirSync(PUBLIC_DIR, { recursive: true });
  cpSync(join(ROOT, "dist"), PUBLIC_DIR, { recursive: true });
  console.log(`\nbuild copiado para ${PUBLIC_DIR}`);

  assertInside(API_DIR, join(PORTFOLIO, "api"));
  rmSync(API_DIR, { recursive: true, force: true });
  const serverDir = join(ROOT, "server");
  for (const file of listFiles(serverDir)) {
    if (!file.endsWith(".ts") || file.endsWith(".test.ts")) continue;
    const target = join(API_DIR, relative(serverDir, file));
    mkdirSync(dirname(target), { recursive: true });
    cpSync(file, target);
  }
  writeFileSync(API_ENTRY, ENTRY);
  console.log(`servidor copiado para ${API_DIR} e ${API_ENTRY} atualizado`);

  run("npx tsc -p tsconfig.api.json", PORTFOLIO);
  run("npx eslint api", PORTFOLIO);
  console.log("\npublicação concluída");
}

main();

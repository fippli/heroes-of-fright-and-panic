import { runCreate } from "./commands/create.ts";
import { runPlay } from "./commands/play.ts";
import { runSpectate } from "./commands/spectate.ts";
import { runAutoPlay } from "./commands/auto-play.ts";
import { runLogin } from "./commands/login.ts";

const USAGE = `
Dusk and Dawn — CLI

Usage:
  cli create    --size <n> --seed <s> --out <path>    Create a new game
  cli play      <file> [--player <day|night>] [--auto] Play a game
  cli auto-play <file> [--delay <ms>]                  AI vs AI (spectate in another terminal)
  cli spectate  <file>                                 Watch a game
  cli login     --email <e> --password <p>             Login to Supabase

Examples:
  pnpm cli create --size 15 --seed game3 --out games/match.json
  pnpm cli play games/match.json --player day
  pnpm cli auto-play games/match.json --delay 500
  pnpm cli spectate games/match.json
  pnpm cli login --email user@example.com --password secret
`;

const rawArgs = process.argv.slice(2).filter((arg) => arg !== "--");
const subcommand = rawArgs.at(0);
const subArgs = rawArgs.slice(1);

switch (subcommand) {
  case "create":
    runCreate(subArgs);
    break;
  case "play":
    runPlay(subArgs);
    break;
  case "auto-play":
    runAutoPlay(subArgs);
    break;
  case "spectate":
    runSpectate(subArgs);
    break;
  case "login":
    runLogin(subArgs);
    break;
  default:
    console.log(USAGE);
    break;
}

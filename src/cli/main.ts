import { runCreate } from "./commands/create.ts";
import { runPlay } from "./commands/play.ts";
import { runSpectate } from "./commands/spectate.ts";

const USAGE = `
Heroes of Fright and Panic — CLI

Usage:
  cli create  --size <n> --seed <s> --out <path>   Create a new game
  cli play    <file> [--player <day|night>] [--json] [--auto] Play a game
  cli spectate <file>                               Watch a game

Examples:
  pnpm cli create --size 15 --seed game3 --out games/match.json
  pnpm cli play games/match.json --player day
  pnpm cli play games/match.json --player night --json < commands.txt
  pnpm cli spectate games/match.json
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
  case "spectate":
    runSpectate(subArgs);
    break;
  default:
    console.log(USAGE);
    break;
}

import {
  loadSupabaseConfig,
  supabaseLogin,
  saveSession,
  loadSession,
  clearSession,
} from "../supabase-client.ts";

const parseArgs = (
  args: ReadonlyArray<string>,
): { email: string; password: string; logout: boolean; status: boolean } => {
  const emailIndex = args.indexOf("--email");
  const passwordIndex = args.indexOf("--password");
  const logout = args.includes("--logout");
  const status = args.includes("--status");

  const email = emailIndex !== -1 ? (args.at(emailIndex + 1) ?? "") : "";
  const password = passwordIndex !== -1 ? (args.at(passwordIndex + 1) ?? "") : "";

  return { email, password, logout, status };
};

export const runLogin = async (args: ReadonlyArray<string>): Promise<void> => {
  const { email, password, logout, status } = parseArgs(args);

  if (logout) {
    await clearSession();
    console.log("Logged out. Session cleared.");
    return;
  }

  if (status) {
    const session = await loadSession();
    if (session === null) {
      console.log("Not logged in.");
    } else {
      const expired = Date.now() > session.expiresAt;
      const expiresLabel = expired ? "EXPIRED" : new Date(session.expiresAt).toLocaleString();
      console.log(`Logged in as: ${session.email}`);
      console.log(`Token expires: ${expiresLabel}`);
    }
    return;
  }

  if (email === "" || password === "") {
    console.error("Usage: cli login --email <email> --password <password>");
    console.error("       cli login --status");
    console.error("       cli login --logout");
    process.exit(1);
  }

  const config = await loadSupabaseConfig();

  try {
    const session = await supabaseLogin(config, email, password);
    await saveSession(session);
    console.log(`Logged in as: ${session.email}`);
    console.log(`Token expires: ${new Date(session.expiresAt).toLocaleString()}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Login failed: ${message}`);
    process.exit(1);
  }
};

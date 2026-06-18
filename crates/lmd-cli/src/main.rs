//! `lmd` — the Linked Markdown command-line tool.
//!
//! A thin wrapper over `lmd-core`. Everything that decides format behavior lives
//! in the library; this binary only does file I/O and process exit codes.

use std::path::PathBuf;
use std::process::ExitCode;

use clap::{Parser, Subcommand};
use lmd_core::Severity;

#[derive(Parser)]
#[command(name = "lmd", version, about = "Linked Markdown toolkit")]
struct Cli {
    #[command(subcommand)]
    cmd: Cmd,
}

#[derive(Subcommand)]
enum Cmd {
    /// Scaffold a new .lmd document.
    New {
        /// Output path.
        path: PathBuf,
        /// Document title.
        #[arg(short, long, default_value = "Untitled")]
        title: String,
    },
    /// Rebuild the manifest (resolve links, refresh hashes) and write the file.
    Build {
        path: PathBuf,
        /// Print to stdout instead of writing the file in place.
        #[arg(long)]
        stdout: bool,
    },
    /// Validate integrity gates. Exits non-zero if any error is found.
    Check { path: PathBuf },
    /// Rewrite the file in canonical form (rebuilds the manifest).
    Fmt {
        path: PathBuf,
        /// Do not write; exit non-zero if the file is not already canonical.
        #[arg(long)]
        check: bool,
    },
    /// Print the link graph (one edge per line).
    Graph { path: PathBuf },
}

fn main() -> ExitCode {
    match run() {
        Ok(code) => code,
        Err(e) => {
            eprintln!("error: {e}");
            ExitCode::FAILURE
        }
    }
}

fn run() -> Result<ExitCode, Box<dyn std::error::Error>> {
    let cli = Cli::parse();
    match cli.cmd {
        Cmd::New { path, title } => {
            let id = uuid_like();
            let doc = format!(
                "---\nlmd: 1\nid: {id}\nversion: 1\ntitle: {title}\n---\n\n# {title} <!--lmd:a intro-->\n\nStart writing here.\n"
            );
            let built = lmd_core::format_str(&doc)?;
            std::fs::write(&path, built)?;
            eprintln!("created {}", path.display());
            Ok(ExitCode::SUCCESS)
        }
        Cmd::Build { path, stdout } => {
            let src = std::fs::read_to_string(&path)?;
            let out = lmd_core::format_str(&src)?;
            if stdout {
                print!("{out}");
            } else {
                std::fs::write(&path, out)?;
                eprintln!("built {}", path.display());
            }
            Ok(ExitCode::SUCCESS)
        }
        Cmd::Check { path } => {
            let src = std::fs::read_to_string(&path)?;
            let doc = lmd_core::parse(&src)?;
            let diags = lmd_core::check(&doc);
            let mut errors = 0;
            for d in &diags {
                let tag = match d.severity {
                    Severity::Error => {
                        errors += 1;
                        "error"
                    }
                    Severity::Warning => "warning",
                };
                let loc = d.line.map(|l| format!(":{l}")).unwrap_or_default();
                eprintln!(
                    "{}{} {} [{}] {}",
                    path.display(),
                    loc,
                    tag,
                    d.code,
                    d.message
                );
            }
            if diags.is_empty() {
                eprintln!("{}: ok", path.display());
            }
            Ok(if errors > 0 {
                ExitCode::FAILURE
            } else {
                ExitCode::SUCCESS
            })
        }
        Cmd::Fmt { path, check } => {
            let src = std::fs::read_to_string(&path)?;
            let out = lmd_core::format_str(&src)?;
            if check {
                if src == out {
                    Ok(ExitCode::SUCCESS)
                } else {
                    eprintln!("{}: not canonical (run `lmd fmt`)", path.display());
                    Ok(ExitCode::FAILURE)
                }
            } else {
                std::fs::write(&path, out)?;
                Ok(ExitCode::SUCCESS)
            }
        }
        Cmd::Graph { path } => {
            let src = std::fs::read_to_string(&path)?;
            let mut doc = lmd_core::parse(&src)?;
            doc.manifest = Some(lmd_core::build(&doc));
            for e in &doc.manifest.unwrap().edges {
                println!("{}  --{}-->  {}", e.from, e.rel, e.to);
            }
            Ok(ExitCode::SUCCESS)
        }
    }
}

/// A fresh document id for the scaffold (UUIDv7, time-ordered).
fn uuid_like() -> String {
    uuid::Uuid::now_v7().to_string()
}

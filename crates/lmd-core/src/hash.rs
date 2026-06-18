//! Content hashing helpers. All hashes are lowercase hex with a `sha256:` prefix.

use sha2::{Digest, Sha256};

pub fn sha256_prefixed(input: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(input.as_bytes());
    let digest = hasher.finalize();
    let hex: String = digest.iter().map(|b| format!("{b:02x}")).collect();
    format!("sha256:{hex}")
}

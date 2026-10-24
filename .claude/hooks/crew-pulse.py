#!/usr/bin/env python3
"""Stop hook: report this session's cache clock to EDI's crew deck.

FSD F32 "the cache clock", keenengvang/edi projects/EDI/TDD.md D229. After each turn it reads the session's own
transcript (every response's token usage, its timestamp, the cache tier it wrote) and POSTs the last turn to
https://edi.keenengvang.com/api/crew/pulse. No auth header: the agent proxy attaches edi-ui's machine credential.
It never blocks a stop: the send is detached, every failure is silent, and it always exits 0. Outside a cloud
session, or in a repo that isn't his, it does nothing. The same file lives in each of his repos.
"""
import json
import os
import re
import subprocess
import sys

URL = "https://edi.keenengvang.com/api/crew/pulse"


def responses(path):
    """Main-thread model responses in order, one per message id (a response's content blocks share one id)."""
    by_id, order, last_prompt = {}, [], -1
    with open(path, encoding="utf-8") as f:
        for line in f:
            try:
                entry = json.loads(line)
            except ValueError:
                continue
            if not isinstance(entry, dict) or not isinstance(entry.get("message", {}), (dict, type(None))):
                continue
            if entry.get("isSidechain"):
                continue
            message = entry.get("message") or {}
            if entry.get("type") == "user" and not entry.get("isMeta"):
                content = message.get("content")
                is_tool_result = isinstance(content, list) and any(isinstance(b, dict) and b.get("type") == "tool_result" for b in content)
                if not is_tool_result:
                    last_prompt = len(order)
            if entry.get("type") != "assistant" or not isinstance(message.get("usage"), dict):
                continue
            if message.get("model") in (None, "<synthetic>"):
                continue
            key = message.get("id") or entry.get("uuid")
            if key not in by_id:
                order.append(key)
            # The first chunk's time: the request was cached by then, and the stream's length isn't cache time.
            at = by_id[key]["at"] if key in by_id else entry.get("timestamp")
            by_id[key] = {"at": at, "model": message["model"], "usage": message["usage"]}
    return [by_id[k] for k in order], last_prompt


def pulse(path, session, repo):
    all_responses, last_prompt = responses(path)
    if not all_responses:
        return None
    turn = all_responses[max(0, last_prompt):] or all_responses[-1:]
    last = turn[-1]
    n = lambda u, k: int(u.get(k) or 0)
    split = lambda u: u.get("cache_creation") or {}
    # The tier the cache was last written at; a turn that only read keeps the one before it.
    ttl = "1h"
    for r in reversed(all_responses):
        tiers = split(r["usage"])
        if n(tiers, "ephemeral_1h_input_tokens") or n(tiers, "ephemeral_5m_input_tokens"):
            ttl = "1h" if n(tiers, "ephemeral_1h_input_tokens") else "5m"
            break
    u = last["usage"]
    return {
        "session": session,
        "repo": repo,
        "at": last["at"],
        "ttl": ttl,
        "model": last["model"],
        "context": n(u, "input_tokens") + n(u, "cache_read_input_tokens") + n(u, "cache_creation_input_tokens"),
        "input": sum(n(r["usage"], "input_tokens") for r in turn),
        "cacheRead": sum(n(r["usage"], "cache_read_input_tokens") for r in turn),
        "cacheWrite": sum(n(r["usage"], "cache_creation_input_tokens") for r in turn),
        "cacheWrite1h": sum(n(split(r["usage"]), "ephemeral_1h_input_tokens") for r in turn),
        "output": sum(n(r["usage"], "output_tokens") for r in turn),
    }


def repo_of(root):
    try:
        url = subprocess.run(["git", "-C", root, "remote", "get-url", "origin"], capture_output=True, text=True, timeout=3).stdout.strip()
    except Exception:
        return None
    m = re.search(r"github\.com[/:](keenengvang/[A-Za-z0-9._-]+?)(?:\.git)?/?$", url)
    return m.group(1) if m else None


def main():
    try:
        hook = json.load(sys.stdin)
    except ValueError:
        return
    remote = os.environ.get("CLAUDE_CODE_REMOTE_SESSION_ID", "")
    if not remote.startswith("cse_"):
        return
    session = "session_" + remote[len("cse_"):]
    root = os.environ.get("CLAUDE_PROJECT_DIR") or hook.get("cwd") or "."
    repo = repo_of(root)
    path = hook.get("transcript_path")
    if not repo or not path or not os.path.exists(path):
        return
    body = pulse(path, session, repo)
    if not body or not body["at"]:
        return
    data = json.dumps(body)
    if os.environ.get("CREW_PULSE_DRY"):
        print(data)
        return
    # Detached, so the stop never waits on the network.
    proc = subprocess.Popen(
        ["curl", "-sS", "-o", "/dev/null", "--max-time", "5", "-X", "POST", URL, "-H", "Content-Type: application/json", "--data-binary", "@-"],
        stdin=subprocess.PIPE, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, start_new_session=True,
    )
    proc.stdin.write(data.encode())
    proc.stdin.close()


if __name__ == "__main__":
    try:
        main()
    except Exception:
        pass
    sys.exit(0)

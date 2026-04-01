#!/usr/bin/env python3
"""
Patch OpenClaw gateway to properly expose cached_tokens in API responses.

Fixes two issues:
1. toUsage() drops cacheRead - adds prompt_tokens_details.cached_tokens
2. Chat Completions non-streaming hardcodes usage to zeros - uses real usage from agent result
"""
import glob
import sys

files = glob.glob('/app/dist/gateway-cli-*.js')
if not files:
    print("ERROR: No gateway-cli-*.js found in /app/dist/")
    sys.exit(1)

filepath = files[0]
print(f"Patching {filepath}")

with open(filepath, 'r') as f:
    content = f.read()

original_len = len(content)

# Patch 1: Fix toUsage() to include prompt_tokens_details.cached_tokens
old1 = 'total_tokens: Math.max(0, total)\n\t};\n}\nfunction extractUsageFromResult'
new1 = 'total_tokens: Math.max(0, total),\n\t\tprompt_tokens_details: { cached_tokens: Math.max(0, cacheRead) }\n\t};\n}\nfunction extractUsageFromResult'

c1 = content.count(old1)
if c1 == 1:
    content = content.replace(old1, new1)
    print(f"  Patch 1 (toUsage + prompt_tokens_details): OK")
else:
    print(f"  Patch 1: FAILED - found {c1} matches (expected 1)")
    sys.exit(1)

# Patch 2: Fix Chat Completions non-streaming to use real usage
old2 = 'const content = resolveAgentResponseText(await agentCommandFromIngress(commandInput, defaultRuntime, deps));'
idx = content.find(old2)
if idx > 0:
    context_before = content[max(0, idx-200):idx]
    if 'senderIsOwner' in context_before:
        new2 = 'const __r = await agentCommandFromIngress(commandInput, defaultRuntime, deps); console.log("[OC-PATCH] result keys:", __r ? Object.keys(__r) : "null"); console.log("[OC-PATCH] meta:", JSON.stringify(__r?.meta, null, 0)?.substring(0, 500)); const content = resolveAgentResponseText(__r); const __u = extractUsageFromResult(__r); console.log("[OC-PATCH] usage:", JSON.stringify(__u));'
        content = content[:idx] + new2 + content[idx+len(old2):]
        print(f"  Patch 2a (result extraction + debug logging): OK")

        # Replace hardcoded usage block
        search_start = idx + len(new2)
        old_usage = 'usage: {\n\t\t\t\t\tprompt_tokens: 0,\n\t\t\t\t\tcompletion_tokens: 0,\n\t\t\t\t\ttotal_tokens: 0\n\t\t\t\t}'
        before = content[:search_start]
        after = content[search_start:]
        if old_usage in after[:1000]:
            after = after.replace(old_usage, 'usage: __u', 1)
            content = before + after
            print(f"  Patch 2b (usage block): OK")
        else:
            print(f"  Patch 2b: WARNING - hardcoded usage block not found nearby")
    else:
        print(f"  Patch 2a: SKIP - context mismatch (not in chat completions handler)")
else:
    print(f"  Patch 2: WARNING - pattern not found, chat completions may have different structure")

with open(filepath, 'w') as f:
    f.write(content)

print(f"  File size: {original_len} -> {len(content)} bytes")
print("Patching complete!")

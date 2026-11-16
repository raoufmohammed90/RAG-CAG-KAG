"""One small helper that sends a prompt to Claude and shows the exchange like a chat.

- In a notebook: chat bubbles. The answer bubble appears once the answer is complete.
- In a terminal: plain text, and the answer streams in word by word.
- Without API credentials, it shows what would be sent, so the demos still run offline.
"""

import html
import re

import anthropic

# ---- Choose the model and effort here (used by every demo) -------------------------------
MODEL = "claude-haiku-5-5"  # smallest, cheapest current model: plenty for short grounded answers
EFFORT = "medium"           # low | medium | high | xhigh | max: how hard the model thinks
# -------------------------------------------------------------------------------------------
client = anthropic.Anthropic()  # reads ANTHROPIC_API_KEY from the environment


def ask(system: str, question: str, cache: bool = False) -> str | None:
    view = NotebookChat(system, question, cache) if _in_notebook() else TerminalChat(system, question, cache)
    # Cache point at the END OF THE SYSTEM PROMPT: that part is identical for every question,
    # so question 2 onwards reads it from the cache. (The question itself changes every time.)
    system_block = {"type": "text", "text": system}
    if cache:
        system_block["cache_control"] = {"type": "ephemeral"}
    try:
        with client.messages.stream(
            model=MODEL,
            max_tokens=2000,
            system=[system_block],
            messages=[{"role": "user", "content": question}],
            output_config={"effort": EFFORT},
        ) as stream:
            for text in stream.text_stream:
                view.add(text)
            response = stream.get_final_message()
    except TypeError as e:  # raised by the SDK when no API key is configured
        if "authentication" not in str(e).lower():
            raise
        view.offline("No API key, so the model was not called. Set ANTHROPIC_API_KEY to run it.")
        return None
    except (anthropic.AuthenticationError, anthropic.APIConnectionError) as e:
        view.offline(f"The model call failed ({type(e).__name__}).")
        return None

    answer = "".join(block.text for block in response.content if block.type == "text")
    view.done(answer, response)
    return answer


def _in_notebook() -> bool:
    try:
        from IPython import get_ipython
        return get_ipython().__class__.__name__ == "ZMQInteractiveShell"
    except ImportError:
        return False


def _usage(response) -> dict:
    u = response.usage
    return {"input": u.input_tokens, "output": u.output_tokens,
            "cache write": u.cache_creation_input_tokens or 0, "cache read": u.cache_read_input_tokens or 0}


class TerminalChat:
    def __init__(self, system, question, cache):
        print("\n--- Prompt sent to the model " + "-" * 30)
        print(f"[system] {len(system):,} characters" + ("  (marked for caching)" if cache else ""))
        print(system if len(system) < 1200 else system[:400] + "\n   ...\n")
        print(f"[user]   {question}")
        print(f"\n--- Answer ({MODEL}, effort: {EFFORT}) " + "-" * 20)

    def add(self, text):
        print(text, end="", flush=True)

    def done(self, answer, response):
        if response.stop_reason == "refusal":
            print("\n(the model declined to answer)")
        print("\n\n--- Tokens: " + "  ".join(f"{k.replace(' ', '_')}={v}" for k, v in _usage(response).items()))

    def offline(self, message):
        print(f"\n--- Offline: {message}")


class NotebookChat:
    """Chat bubbles in the notebook. Colours are translucent, so they work in light and dark themes."""

    BOX = "font-family:var(--vscode-font-family,system-ui,sans-serif);font-size:13px;line-height:1.5;color:inherit;"

    # Each piece is displayed ONCE and never updated in place: VS Code does not reliably
    # apply in-place output updates, so the answer bubble appears when the answer is complete.

    def __init__(self, system, question, cache):
        from IPython.display import HTML, display
        self.HTML, self.display = HTML, display
        display(HTML(self._context(system, cache) + self._bubble("user", "🧑 Employee", html.escape(question))))

    def add(self, text):
        pass  # the full answer is shown by done()

    def done(self, answer, response):
        body = self._markdown(answer) if answer.strip() else '<i style="opacity:.7">(no text in the answer)</i>'
        if response.stop_reason == "refusal":
            body += '<p style="opacity:.7"><i>The model declined to answer.</i></p>'
        self.display(self.HTML(self._answer(body, response.model) + self._chips(_usage(response))))

    def offline(self, message):
        self.display(self.HTML(self._answer(f'<i style="opacity:.7">{html.escape(message)}</i>')))

    # ---- pieces -------------------------------------------------------------------
    def _context(self, system, cache):
        lines = []
        for line in html.escape(system).splitlines():
            label = re.fullmatch(r"\[(.+)\]", line) or re.fullmatch(r"&lt;document name=&#x27;(.+)&#x27;&gt;", line)
            if label:
                lines.append(f'<span style="display:inline-block;margin-top:8px;padding:1px 8px;border-radius:10px;'
                             f'background:rgba(245,158,11,.18);font-weight:600">{label.group(1)}</span>')
            elif line != "&lt;/document&gt;":
                lines.append(line)
        is_open = " open" if len(system) < 1500 else ""
        cached = " · 🗄️ marked for caching" if cache else ""
        return (f'<details{is_open} style="{self.BOX}margin:4px 0 10px;border:1px solid rgba(127,127,127,.35);'
                f'border-radius:10px;padding:8px 12px;max-width:820px">'
                f'<summary style="cursor:pointer;font-weight:600">📄 What the model receives '
                f'<span style="font-weight:400;opacity:.7">· system prompt · {len(system):,} characters{cached}</span>'
                f'</summary><div style="white-space:pre-wrap;margin-top:6px;font-size:12.5px">'
                + "\n".join(lines) + "</div></details>")

    def _bubble(self, side, who, body, extra=""):
        right = side == "user"
        colour = "rgba(59,130,246,.18)" if right else "rgba(127,127,127,.13)"
        return (f'<div style="{self.BOX}display:flex;justify-content:{"flex-end" if right else "flex-start"};'
                f'margin:6px 0;max-width:820px"><div style="background:{colour};border-radius:14px;'
                f'{"border-bottom-right-radius:4px" if right else "border-bottom-left-radius:4px"};'
                f'padding:8px 14px;max-width:85%"><div style="font-size:11.5px;opacity:.7;margin-bottom:2px">{who}</div>'
                f'{body}</div></div>{extra}')

    def _answer(self, body, model=MODEL):
        return self._bubble("assistant", f"🤖 Claude · {model} · effort: {EFFORT}", body)

    def _chips(self, usage):
        tint = {"cache write": "rgba(245,158,11,.25)", "cache read": "rgba(34,197,94,.25)"}
        chips = "".join(f'<span style="padding:1px 8px;border-radius:10px;margin-right:6px;'
                        f'background:{tint.get(k, "rgba(127,127,127,.15)") if v else "rgba(127,127,127,.08)"}">'
                        f'{k} <b>{v:,}</b></span>' for k, v in usage.items())
        return f'<div style="{self.BOX}font-size:11.5px;margin:2px 0 8px 4px;opacity:.85">tokens: {chips}</div>'

    @staticmethod
    def _markdown(text):
        import mistune
        return mistune.html(text)

/* Chat — see css/components/chat.css for markup. No backend: your code
   answers the 'jewel:chatsend' event.

   Sending (Enter, or the send button; Shift+Enter is a new line, and on
   touch screens Enter is a new line too):
     the message is added to the log, the composer clears, a typing
     indicator shows, and 'jewel:chatsend' fires on .chat (bubbles) with
     detail { text, respond(answer) }.
     answer: a string (or HTML via { html }), or a Promise of one. While it's
     pending the send button is busy. A rejected promise shows an error
     message with a Retry button.

   data-chat-demo on .chat answers with a canned reply when nobody else
   does, so the shell can be shown on its own.

   [data-chat-prompt] buttons send their own text.
   API: el.jewelChat.add('user' | 'bot', text | { html }) → <li>
        el.jewelChat.typing(bool)   el.jewelChat.clear() */

(() => {
  const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const paragraphs = (s) => s.trim().split(/\n{2,}/).map((p) => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('');

  Jewel.register('chat', (root) => {
    const log = root.querySelector('.chat__log');
    const form = root.querySelector('.chat__composer');
    const input = root.querySelector('.chat__input');
    const send = root.querySelector('.chat__send');
    if (!log || !form || !input) return;
    const botName = log.querySelector('.chat__msg--bot .chat__author')?.textContent.trim() || 'Assistant';
    log.tabIndex = 0;
    let typingEl = null;
    let busy = false;

    const scrollDown = () => log.scrollTo({ top: log.scrollHeight, behavior: Jewel.reducedMotion.matches ? 'auto' : 'smooth' });

    function add(role, content) {
      const li = document.createElement('li');
      li.className = `chat__msg chat__msg--${role}`;
      const html = typeof content === 'object' && content?.html != null ? content.html : paragraphs(String(content));
      li.innerHTML = `<p class="chat__author">${role === 'user' ? 'You' : esc(botName)}</p><div class="chat__text">${html}</div>`;
      if (typingEl) log.insertBefore(li, typingEl); else log.append(li);
      scrollDown();
      return li;
    }

    function typing(on) {
      if (on && !typingEl) {
        typingEl = document.createElement('li');
        typingEl.className = 'chat__msg chat__msg--bot';
        typingEl.setAttribute('aria-label', `${botName} is typing`);
        typingEl.innerHTML = '<span class="chat__typing" aria-hidden="true"><span></span><span></span><span></span></span>';
        log.append(typingEl);
        scrollDown();
      } else if (!on && typingEl) {
        typingEl.remove();
        typingEl = null;
      }
    }

    function setBusy(on) {
      busy = on;
      send?.setAttribute('aria-busy', String(on));
      if (send) send.disabled = on;
    }

    function submit(text) {
      const t = text.trim();
      if (!t || busy) return;
      root.classList.add('is-started');
      add('user', t);
      input.value = '';
      input.dispatchEvent(new Event('input'));
      typing(true);
      setBusy(true);

      let answered = false;
      const respond = (answer) => {
        answered = true;
        Promise.resolve(answer)
          .then((a) => { typing(false); add('bot', a); })
          .catch((err) => {
            typing(false);
            const li = add('bot', { html: `<p>${esc(err?.message || "Sorry, that didn't go through.")}</p><button class="btn btn--ghost" type="button" data-chat-retry>Retry</button>` });
            li.classList.add('chat__msg--error');
            li.querySelector('[data-chat-retry]').addEventListener('click', () => { li.remove(); log.lastElementChild?.remove(); submit(t); });
          })
          .finally(() => { setBusy(false); });
      };
      root.dispatchEvent(new CustomEvent('jewel:chatsend', { bubbles: true, detail: { text: t, respond } }));

      if (!answered) {
        if ('chatDemo' in root.dataset) {
          respond(new Promise((ok) => setTimeout(() => ok(`This is a demo reply. Connect a backend by listening for "jewel:chatsend" and calling respond() with the answer to “${t}”.`), 900)));
        } else {
          typing(false);
          setBusy(false);
        }
      }
    }

    form.addEventListener('submit', (e) => { e.preventDefault(); submit(input.value); });
    input.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' || e.shiftKey || e.isComposing) return;
      if (matchMedia('(pointer: coarse)').matches) return;
      e.preventDefault();
      submit(input.value);
    });
    // Auto-grow where field-sizing isn't supported.
    if (!CSS.supports('field-sizing', 'content')) {
      input.addEventListener('input', () => { input.style.height = 'auto'; input.style.height = `${input.scrollHeight}px`; });
    }
    root.addEventListener('click', (e) => {
      const p = e.target.closest('[data-chat-prompt]');
      if (p) submit(p.dataset.chatPrompt || p.textContent);
    });

    root.jewelChat = {
      add, typing,
      clear() { log.replaceChildren(); typingEl = null; root.classList.remove('is-started'); },
    };
  });
})();

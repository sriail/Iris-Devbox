# Iris AI Devobxes (Beta)

> [!NOTE]
> Hi :), this is just a small project. I thought softwhere like github copilot where overpiced for what they where, and i wanted a similar solution,
> but running fully in browser, as AI desktop codign apps (Like Codex) and IDE's (like Claude Code) where already a crowded space, and did not fit my
> needs. If you use or like this repo, consider giving us a star!

## Quick Info

Many modern Programs like this require installing aplacations like Docker, to host VM for LLM's on your owen hardwhere, or Paying for a heavy VPS on the cloud, 
or a service like GH Copilot. Iris Works in an entireley difftent way. It uses V86, and a lightweight Cloudflare worker, to run a Lightweight, Github Copilot levle experence fully from the client browser!

![Architecture (Light)](readme/readme-image-arcatecture-dark.png#gh-light-mode-only)
![Architecture (Dark)](readme/readme-image-arcatecture-light.png#gh-dark-mode-only)

## Deploy

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/sriail/Iris-Devbox)

Click the Qepoly button and add your owen api key as a .env in the workers config!

## Roadmap (No Particular Order)

- [ ] Achive a working Prototype
- [ ] Update PWA
- [ ] Add Multi - Provider support
- [ ] BYOK Support
- [ ] Home Page
- [ ] Sugestion Select
- [ ] More Skills And Task Agents

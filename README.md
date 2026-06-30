# Iris AI Dev Boxes (Beta)

> [!NOTE]
> Hi :) , this is just a small project. I thought software like github copilot was overpriced for what they where, and i wanted a similar solution,
> but running fully in browser, as AI desktop coding apps (Like Codex) and IDE's (like Claude Code) where already a crowded space, and did not fit my
> needs. If you use or like this repo, consider giving us a star!

## Quick Info

Many modern Programs like this require installing applications like Docker, to host VM for LLM's on your own hardware, or Paying for a heavy VPS on the cloud, 
or a service like GH Copilot. Iris Works in an entirely different way. It uses V86, and a lightweight Cloudflare worker, to run a Lightweight, Github Copilot level experience fully from the client browser!

![Architecture (Light)](readme/readme-image-arcatecture-dark.png#gh-light-mode-only)
![Architecture (Dark)](readme/readme-image-arcatecture-light.png#gh-dark-mode-only)

## Deploy

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/sriail/Iris-Devbox)

Click the Deploy button and add your own api key as a .env in the workers config!

## Roadmap (No Particular Order)

- [ ] Achieve a working Prototype (DO NOW lol)
- [ ] Update PWA
- [ ] Add Multi - Provider support
- [ ] BYOK Support
- [ ] Home Page
- [ ] Suggestion Select
- [ ] More Skills And Task Agents

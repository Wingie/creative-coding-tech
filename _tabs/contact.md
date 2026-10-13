---
layout: page
title: Contact
icon: fas fa-envelope
order: 7
---

<div class="consulting-contact">

<p class="contact-lead">I work on two things. One is measuring what AI systems actually do. The other is music and technology on stage, made to entertain people.</p>

<p>Tell me what you're working on and what's in the way. If I'm not the right person, I'll say so. I usually know someone who is.</p>

<div class="contact-links">
  <a href="mailto:creativecodingtech@proton.me" class="contact-link-item">
    <i class="fas fa-envelope"></i>
    <span>creativecodingtech@proton.me</span>
  </a>
  <a href="https://linkedin.com/in/wingstonsharon" target="_blank" rel="noopener" class="contact-link-item">
    <i class="fab fa-linkedin"></i>
    <span>linkedin.com/in/wingstonsharon</span>
  </a>
  <a href="https://github.com/wingie" target="_blank" rel="noopener" class="contact-link-item">
    <i class="fab fa-github"></i>
    <span>github.com/wingie</span>
  </a>
</div>

<h2 class="contact-form-title">Send a message</h2>

<p id="contact-sent" class="contact-sent" hidden>Thanks, your message reached me. I'll reply by email.</p>

<form id="contact-form" action="https://formsubmit.co/creativecodingtech@proton.me" method="POST" class="oracle-form">
  <input type="hidden" name="_subject" value="Message from creativecodingtech.com">
  <input type="hidden" name="_captcha" value="false">
  <input type="hidden" name="_next" value="https://creativecodingtech.com/contact/?submitted=true">

  <div class="form-group">
    <label for="name">Your name</label>
    <input type="text" id="name" name="name" required autocomplete="name">
  </div>

  <div class="form-group">
    <label for="email">Your email</label>
    <input type="email" id="email" name="email" required autocomplete="email">
  </div>

  <div class="form-group">
    <label for="company">Company or organisation (optional)</label>
    <input type="text" id="company" name="company" autocomplete="organization">
  </div>

  <div class="form-group">
    <label for="service">What is it about?</label>
    <select id="service" name="service">
      <option value="">Pick one</option>
      <option value="ai-ml">AI and machine learning engineering</option>
      <option value="sovereign-ai">Running AI on your own hardware</option>
      <option value="governance">Testing what an AI system actually does</option>
      <option value="creative-tech">Music, installations and live AV</option>
      <option value="echo-garden">Echo Garden or the ADE Lab Hackathon</option>
      <option value="workshops">Workshops and facilitation</option>
      <option value="compute">Lending GPUs or compute</option>
      <option value="role">A job</option>
      <option value="other">Something else</option>
    </select>
  </div>

  <div class="form-group">
    <label for="context">What are you working on?</label>
    <textarea id="context" name="context" rows="5" required placeholder="What are you building, and what's stuck?"></textarea>
  </div>

  <div class="form-group">
    <label for="timeline">When do you need it? (optional)</label>
    <input type="text" id="timeline" name="timeline" placeholder="This month, next quarter, just looking">
  </div>

  <button type="submit" class="submit-button">Send</button>
</form>

<script>
  if (new URLSearchParams(location.search).get("submitted") === "true") {
    document.getElementById("contact-sent").hidden = false;
    document.getElementById("contact-form").hidden = true;
  }
</script>

</div>

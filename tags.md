---
title: "All Tags"
layout: page
permalink: /tags/
---

<h2>Post Tags</h2>

<ul>
  {% for tag in site.tags %}
    <li>
      <a href="/tags/{{ tag | first | slugify }}/">{{ tag | first }}</a> ({{ tag | last | size }})
    </li>
  {% endfor %}
</ul>
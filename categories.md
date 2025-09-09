---
title: "All Categories"
layout: page
permalink: /categories/
---

<h2>Post Categories</h2>

<ul>
  {% for category in site.categories %}
    <li>
      <a href="/categories/{{ category | first | slugify }}/">{{ category | first }}</a> ({{ category | last | size }})
    </li>
  {% endfor %}
</ul>
---
---
### Introduction

If you are interested in GDB, Python and Arm Assembler, I hope this will be an intereting place to be.

### Blogs 

<ul>
  {% for post in site.posts %}
  <li>
      <a href="{{ post.url }}">{{ post.title }} - {{ post.date | date: '%d %b %Y' }}</a>
  </li>
 {% endfor %}
</ul>

### Resources
[Gdb Basic Setup]({{ site.github_url }}gdb-python/wiki/Gdb-Basic-Setup)

<nav>
  <ul>
    <li><a href="{{ site.github_url }}">GitHub</a></li> |
    <li><a href="{{ site.url }}/about">About & Contact</a></li>
  </ul>
</nav>

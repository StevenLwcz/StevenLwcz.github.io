---
description: GDB, Python, ARM, RISC-V, Assembler, GDB Python API, Low Level Debugging
---
### Introduction

If you are interested in GDB, Python and Arm Assembler, RISC-V and other low level things, I hope this will be an interesting place to be.

### Posts 

<ul>
  {% for post in site.posts %}
  <li>
      <a href="{{ post.url }}">{{ post.title }} - {{ post.date | date: '%d %b %Y' }}</a>
  </li>
 {% endfor %}
</ul>

### Wiki Pages
1. [GDB Basic Setup]({{ site.github_url }}gdb-python/wiki/Gdb-Basic-Setup)
1. [Printing Variables in GDB]({{ site.github_url }}gdb-python/wiki/Printing-Variables-in-GDB)

<nav>
  <ul>
    <li><a href="{{ site.github_url }}">GitHub</a></li> |
    <li><a href="{{ site.url }}/about">About & Contact</a></li>
  </ul>
</nav>

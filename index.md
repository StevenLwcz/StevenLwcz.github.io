{% include header.html %}

### Introduction

I've been exploring the Python API for GDB and want to consolidate what I've learnt in some blog posts. I've also been learning Arm Assembler and want to write some blogs on this too. And because I'm a developer I don't want to just pick a Jeykll theme and make my life easy (not in the beginning anyway), I'll be learing Jeykll, liquid etc and slowly making this site look prettier.

### Blogs 

<ul>
  {% for post in site.posts %}
  <li>
      <a href="{{ post.url }}">{{ post.title }} {{ post.date | date: '%B %d, %Y' }}</a>
  </li>
 {% endfor %}
</ul>

### Resources
[Gdb Basic Setup]({{ site.github_url }}gdb-python/wiki/Gdb-Basic-Setup)

*** 
<nav>
  <ul>
    <li><a href="{{ site.github_url }}">StevenLwcz on GitHub</a></li>
  </ul>
</nav>

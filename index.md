<ul>
  {% for post in site.posts %}
  <li>
      <a href="{{ post.url }}">{{ post.title }} {{ post.date | date: '%B %d, %Y' }}</a>
  </li>
 {% endfor %}
</ul>

### Resources
[Gdb Basic Setup]{{ site.github.url}}gdb-python/wiki/Gdb-Basic-Setup)

*** 
<ul>
<li><a href="{{ site.github_url }}">StevenLwcz on GitHub</a></li>
</ul>

<ul>
  {% for post in site.posts %}
  <li>
      <a href="{{ post.url }}">{{ post.title }}</a>
  </li>
 {% endfor %}
</ul>

*** 
<ul>
<li><a href="https://github.com/{{ site.github_username }}">GitHub</a></li>
</ul>

## This is my 1st blog post.


- Part 1 of this blog will go over the basics to create a window to display some text.
- Part 2 will add a custom gdb command to allow us to add any text to the window.
- Part 3 will build on all of that to help us create a window to add variables to watch while we step through our program. 
- Part 4 we will create an autos window.


```
class HelloWindow(object):

    def __init__(self, tui):
        self.tui = tui
        self.tui.title = "Hello Window"

    def render(self):
        pass

    def close(self):
        pass

    def hscroll(self, num):
        pass

    def vscroll(self, num):
        pass

    def click(self, x, y, button):
        pass
```

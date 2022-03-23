---
author: StevenLwcz
layout: post
---
In this part we will extend our HelloWindow class to be able to display any text from a custom GDB command. 
The [Commands in Python](https://sourceware.org/gdb/onlinedocs/gdb/Commands-In-Python.html#Commands-In-Python) docs give us a code snippet which we can build on.

**hellotuicmd.py**

```python
class AddTextCmd(gdb.Command):
    """Add text to the Tui window hello
addtext [string]
string = text to be displayed"""

    def __init__(self):
       super(AddTextCmd, self).__init__("addtext", gdb.COMMAND_USER)

    def invoke(self, arguments, from_tty):
        print(arguments)

# create an instance of our command class to register with gdb and keep a reference for later.
addTextCmd = AddTextCmd()
```

The class name can be anything but must inherit from `gdb.Command`. The rather complex `super()` line defines the actual command we want to use and registers everything with GDB. When we enter our command in GDB the `invoke()` method gets called. To make GDB aware of our class we create an instance of our class. 

Load this into GDB and check our command gets registered by checking the help.

```shell
$ gdb -q
```

```
(gdb) so hellotuicmd.py
(gdb) help user-defined

List of commands:

addtext -- Add text to the Tui window hello
```

GDB has used the 1st line of the Python docstring for the help. To see the rest of the help:

```
(gdb) help addtext
Add text to the Tui window hello
addtext [string]
string = text to be displayed
```

It is always good to create help for our commands. Especially if you want others to use your code. Does the command work?

```
(gdb) addtext hello world
hello world
```

Arguments is just a string of what was given to the command. This will suit us fine for now. But can be broken down into space separated and converted to a list using `gdb.string_to_argv()`.

{% highlight python %}
def invoke(self, arguments, from_tty):
    args = gdb.string_to_argv(arguments)
    for a in args:
        print(a)
{% endhighlight %}
```
(gdb) addtext hello world
hello
world
```

This is great but how do we tie it back to our HelloWindow class?

First of all we want to register the HelloWindow class with the AddTextCmd class. This is done by adding a little method.

{% highlight python %}
class AddTextCmd(gdb.Command)

    def set_win(self, win):
        self.win = win
{% endhighlight %}

Then another method to set the text to display in the HellowWindow class.

{% highlight python %}
Class HelloWindow(object)

   def set_text(self, text):
        self.text = text
{% endhighlight %}

Now update the `render()` method to display the text.

{% highlight python %}
     def render(self):
        self.tui.write(f'{GREEN}{self.text}{RESET}{NL}')
{% endhighlight %}

For our command's `invoke()` method we can set the text and call the `render()` method.

{% highlight python %}
def invoke(self, arguments, from_tty):
    self.win.set_text(arguments)
    self.win.render()
{% endhighlight %}

In our factory function we let the AddTextCmd class know about the HelloWinow class by using `addTextCmd.set_win()`.

{% highlight python %}
# Factory Function
def HelloWinFactory(tui):
    win =  HelloWindow(tui)
    # register the Window class with the addtext command
    addTextCmd.set_win(win)
    # pass back our WIndow class to gdb
    return win
{% endhighlight %}

Now everything is linked together. The complete example can be found in my [GitHub repository](https://github.com/StevenLwcz/gdb-python-blog).

Lets tweak the **hello.gdb** from the previous blog.

```
source hellotuicmd.py
tui new-layout mylayout hello 1 cmd 1
layout mylayout
```
```shell
$ gdb -q -x hello.gdb
```
GDB goes into Tui mode and displays our window. Now we can add more text to the window.

```
(gdb) addtext hello world 1
(gdb) addtext hello world 2
```
![](/images/TuiWindow2.png)

The window cam be cleared before each write by using `erase()`.

```python
    self.tui.erase()
    self.tui.write(f'{GREEN}{self.text}{RESET}{NL}')
````

The `render()` method gets called each time GDB is resized and I think this grows GDB's view of the window and odd things start happening incluing crashing with a core file. Adding the `erase()` method helps. 

So if we want to add to the window we need to store the contents in a list or other collection and rewrite the window contents from that. We will see this in action in the next blog.

We have not looked at the two `scroll()` methods or the `click()` method. Holding the contents in a collection and displaying based on keeping track of an internal position is probably what is needed. Something else to explore in a future blog. The `close()` method we will look at soon.

In the next part we will build on this framework to create a GDB command to display variables in our Tui Window. This will also involve looking deeper into what the GDB Python API has to offer.


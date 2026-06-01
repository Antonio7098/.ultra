---
applicable_dimensions:
  - "01"
  - "05"
  - "12"
---

# Automate common code review chores with DangerJS

**Source**: https://www.youtube.com/watch?v=J2ITov8r0Rs

## Transcript

hey what's up everybody i'm dave bitter
from the developer at frontman and today
i have another friday tip for you we're
gonna have a look at danger yes which is
a tool that will help you with your
pipelines to perform automated checks
for the pull request itself
if we head over to their website we can
see that basically danger.js
runs during your ci process
and to do automated common code review
chores
so what a normal workflow would look
like is
you push your code you maybe run some
lint there some tests and this is where
danger then comes in
to already do some checks for your pull
request itself so
you might have some
conventions in your team where you say
hey we need a description it needs to be
a minimum of this long
or some other checks like
there's a new javascript file at it but
there's no test file for it all those
things can take quite a bit of time if a
human needs to do that every time and it
would be better if you can automate a
process like that
so if we scroll a bit further we can see
that
in the end it's basically a simple
module which exports some utilities for
you
to run so let's head over to an actual
project of mine my personal website and
let's see if we can automate some of the
stuff that you would normally
manually need to do during the review
process you can see my personal website
right here i cloned it and i already
made some changes so besides installing
danger.js of course
i added a file here called the danger
file
and if we open this we can see that
well i import the danger.js module
have a look at see which are the files
that are modified
normally you could do this yourself as
well right
to
check oh which files are changed but
this just makes it easier there's this
utility you can say hey
danger.get.modifiedfiles those are all
the files that changed so it might be
nice to give a short message there in
the overview of the pull request to
show which files are changed what we can
do as well is say okay i use github for
my portfolio website so i might want to
have some information from github itself
for instance where the assignees to this
pull request well we can easily do that
now because we can say okay danger dot
get up
for this pr
is there so is there an assignee if
that's not the case we might want to
check well is this maybe a work in
progress branch does somebody
just trade the pull request but they
don't want to merge it yet so it's fine
uh in that case
we want to warn the people saying hey
you need to add somebody in the end
but if it's not if it's a regular pull
request and yeah we want to to fill it
with this method then so warn or fill
we can give some information to the
person who opens the pull request for
instance we need an assignee
and optionally maybe include some
reviewers to this as well
well next to that we could for instance
check
on github for this pr get the body and
then check whether
it's less than 10 characters in that
case it's probably a super short
description which probably won't say
that much about what you changed
so you could say okay we need a
description write a proper description
so these might seem like a super simple
task and they are
but you don't want to have to do this
manually a person
for all these pull requests you can
imagine if you work in a very large team
perhaps at a client
and you have 50 developers opening pull
requests all over the place
it can be quite a hassle to every time
say hey
remember you have to do this and usually
you would write something like that in
the documentation
but it always slips through and this is
a nice tool to
well let people already make the perfect
full request so it makes it easier to
review their code changes great so now
we have this file we need to run this of
course
what i'm going to use since i'm using
github is github actions
which is github's way to that you run
these these pipelines and these
automated tasks if you've never worked
with github actions i actually got a
friday tip about it which you can watch
and i'll make sure to link it below if
we head over to the github folder with
workflows you can see that i actually
already got some automated tasks for my
portfolio website but i added a new file
called danger.yaml
and if we open this up we gave it a name
for now danger yes and we can actually
say oh on this event
i want to run this so whenever somebody
makes a pull request
i have some jobs to do
so it's going to run on the latest
ubuntu that's going to have some steps
but in the end it's just going to run
the danger ci what this danger ci does
is it will take this danger file.js and
it will actually execute it and will
handle it accordingly so let's make a
commit
for instance i added the danger.js
example
and we're going to push it
to danger jazz
we head over
to github
we can go to my pull request and we can
see that you just push this so compare
pull request
and
i can write a comment uh
this is a test for
danger yes
but when i create this pull request
and we
wait for a second you can see that some
of the
ci is going to run so i got preview
branches for my website that's outside
of the scope of this
video but you can see that the danger.js
rule is being kicked off because of the
pull request
so if we have a look
we can see that it's setting everything
up installing everything
and then running danger
to check
after it's done you can go back after
refreshing the page we can see that the
github actions say hey
there are some fills
the plural cred needs an assignee
and maybe some reviewers
as well as the message that we added
saying these are the files that changed
so this makes sense let's add
myself as an assignee
and what we need to do now of course is
to run that action again so let's head
over to the checks
we can see the danger.js task here and
we can rerun this job
so it's going to run it again we can go
back to the pull request
and we can see that the check is started
here
in progress
go to details you can see that again
it's setting everything up and using the
correct note version
then it's running danger again
and when it's done we can go back to the
pull request
now we need to give it a sec
maybe refresh
and we can see that now the danger.js
task has
been executed and as well that the
message with the error is is gone so
this indicates to
well i'm the only person working on this
project but to the team
that
everything is fine right now these are
the change files and you're free to
to review the code now you can do
whatever you want of course you can
create your own file and
enforce the rules that you have on your
project so danger.js is not going to
offer you
a bunch of standard rules or templates
or whatnot no it's going to offer you
the utilities and with those utilities
you can easily
create your own checks specific to your
project
this will in the end help your team with
having a better workflow for pull
requests and automating some stuff that
normally you would have to do manually
with somebody's time
that's all for today so as always thank
you for watching and i'll see you in the
next one bye

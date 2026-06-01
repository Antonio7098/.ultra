---
applicable_dimensions:
  - "01"
  - "04"
  - "10"
  - "13"
---

# Harnessing the power of AI in the Gerrit Code Review process

**Source**: https://www.youtube.com/watch?v=vgp4tHoBlhY

## Transcript

Guys, you won't believe it, but as last
presentation, we were talking about AI.
Wow.
So, first, uh, that's the new logo of G
code review. Do you like it?
AI.
Yeah, of course it is. Yeah, of course
it is. Okay, so I'm not going to
actually spend a lot of time otherwise I
will lose my flight. I will miss my
flight. But, uh, I want to give you an
overview. is a little bit of a deep dive
of what Tony already presented when was
saying what's new about Gary 313, right?
And we'll try not to be too long. So
let's skip this one. So I'm going to
talk about slightly and shortly about
the history of AI support in Garrett and
then the issues we go with the current
situation which is messy. then uh how
Google approaches actually the AI part
and I'm going to be a bit blurry because
they haven't disclosed it right so I can
just tell not what I know but what I can
read in the code right so whatever I'm
saying is not a disclosure of
confidential information it's just stuff
that is in the code so I read the code I
say what I read and this is how Google
is doing it then uh what's new in Gary
313 and then of course um how we are
planning to move on that's the important
thing right what's the plan for Garrett
for AI
timeline so first of course in 2022
charg came out and just changed
everything in in the way we work and the
way that investors work mainly right and
uh shortly afterwards we had the first
presentation of AI integration back in
2023 who remembers that raise your hand
there was one guy from China that I
never heard about it and it completely
disappeared but he created a plug-in for
basically integrating it was a very
simple plugin was just getting the
feedback from the hook and getting the
content of the changes send it to JHP it
was posting just a comment with the full
output of chich in just a whole comment
and he provided this one was the charg
co plug-in
and then uh some other guys from uh uh
Amorula solutions uh instead of
contributing to that plug-in, they
created a fork of that plugin on GitHub.
GitHub is for forks, right? If you don't
fork, you're not good, right? Another
fork. They presented an evolution of the
same concepts in the Garrett meets in
May 2024. We are two forks. Is two forks
enough?
No. Wow. If you don't have at least
250,000 forks, you're not a you're not a
star, right? And we had a third fork. So
last year the guys from a guy from
Sirata. So instead again of contributed
to the second fork he created a third
fork on a plugin. Now we go three and he
did a he basically changed the name of
CHD plugin to AI code review and
basically plug um llama right that is on
premises LLM and then he presented the
Gary user submit in Qualcomm right and
we got the third for
which one is the best
none of them because actually the
overall approach is flowed and I'm going
to tell you why the the main reason is
because they all of them what they were
doing was getting the entire content of
the change and give it to the LLM and
say can you tell me something about this
change what's wrong with the approach
raise your hand if you're still alive
and I know it's Sunday is 3:30 3:40 no
oh no 2:40 sorry I there we go what's
wrong with the approach
you are still alive good
well I'm going to guess it doesn't have
actually power content beyond the It's
just the unit.
Excellent. So that's the first one.
Content. Anyone else?
I'm going to tell you what's basically
wrong. This is one thing. Yes. And that
actually doesn't allow to understand
what is the context of the change and
then the context of the code and say
something meaningful. But because it
doesn't have the context, then the
problem is that what is providing us an
output is syntactical and not mostly
useful. Right? So what does it mean that
by using it and actually we installed it
on GitHub and we used it and we saw that
the most useful things that were the tri
stuff. So typos or very common errors
something that actually errorprone
catches very well. So why do we really
need chpt and burn all these trees in
the Amazon right for just saying
something you could do with errorrone
right but the second problem they were
sticking those comments into the
metadata right and then your rile grows
and grows and grows and grows with
something that is spam at the end of the
day so none of them are actually a good
approach and actually from 313 onwards
all of them are basically deprecated
because the robot comments they are
generating they're not supported anymore
so gone
So what is the new approach? The new
approach is slightly different. So uh
Gary 313 has the ability to generate the
prompt what instead of doing in a
plug-in that is not visible to you is
asking you okay what would you like to
ask to Chad GPT or Gemini or whoever and
then based on a prompt at the moment in
313 out of the box you get the prompt we
take the type of suggest you want from
the AI you want to suggest you know on
general change or maybe the patch set or
the code or maybe improve the commit
message to avoid diapers or whatever.
Okay. And then you can copy and paste
that one into your AI and get it back
and then you decide what it makes sense
to keep. This is going to be in Gary
313. You don't need any plug-in for
that. Okay. So, Gary 33
comes out. All those three forks, I'm
sorry guys, they're all obsolete. So, uh
the issues are the ones that I was
mentioning before. And also the problem
is it was very difficult sometimes to
understand why was giving you this type
of suggestions. So all these plugins
they had a very complicated way of
debugging things and understanding why
was doing that and you need to learn all
these kind of dialects and these are
language inside the language and then of
course they got because you've got
developers working on three different
forks of course they're going to have
the same bugs. They need to fix them
three times. Then you got the complexity
of people using one plugin on the
mailing list, another maintainer on
another fork say yeah I fixed it say but
I don't see it no that's another fork is
messy right and they try to talk to each
other they don't even agree or do the
same project so I believe it's something
that Gary should do in core and Garrett
is doing in core right so the
consequences are the one that I
mentioned before so let's keep quickly
at Google what they do they deprecated
robot comments If you try to write any
plug-in that generates robot comments,
you get the same message you saw before
in the UI. Robbo comments not supported,
right? And instead the approach is not
to do the server talking to the AI but
involving the communication with the
developer. So surfacing the AI to the
developer and having Garrett and AI
working side by side helping you as a
developer to improve your code. But that
is not AI giving review. you give review
AI will tell you some suggestions about
the re review I use personally so this
one is installed already on Gearhubio
and people are using Ghabio and I use it
also a lot on G review I found it very
useful and I found that even if it's
useful only for the 20% of the
suggestion those 20% are really good
right and I'm really happy that I don't
stick the other 8% in the history right
otherwise it just becomes noise
um the problem that I see is now a
usability problem. It's really a user
interface problem because if you face
yourself, what do you have to do? You go
to a change, you see the link, you click
the link, it opens another window, you
copy, then you go to your chat GPT,
Gemini, whatever code, you paste it
there, you wait five minutes, they will
give you the suggestion, you read the
suggestion and there you go. It's messy,
right? So, we are doing something in
Garrett for improving that workflow. But
now we are talking about the user
experience that needs to be improved.
For instance, I quite like in Gitb
Butler that was only integrated right
with UI you say just do this and all
this kind of mechanism gbuffler takes
takes care of it. I believe we should do
something similar with Garrett as well.
Okay. Uh there is a design proposal
that's the thing that I like. So instead
of just going coding something and say
guys is there try it out. So who we are
are we let's say your kind of uh uh
rabbit that used to just run and tried
everything and we'll tell you it was
something. So you should design this is
something important right we shouldn't
just throw code out to the fence we
should decide with the rest of community
the right thing to do so the SAP guys
they wrote a design document right and
um they actually are looking for
suggestion and looking for feedback so
look at the design document look at the
feedback if you link if you take a
picture of that link that's the repo
discuss link the slides are going to be
published anyway and just be involved
So uh the way that will work will be
basically split in three parts. The
first part will be uh the problem that
you see right will not be anymore
state uh so let the next one yeah so the
support will be split in three parts.
The prompt will not be generated anymore
on the client side right but will be
generated on the back end. At the moment
that prompt is encoded in JavaScript. So
it's very difficult to be pluggable
because you need to read it from a
JavaScript plug-in. They will need to
read it and change dynamically the UI is
going to be messy, right? So that change
has been merged already. It's been
approved. Sorry, approved, not merged
yet. So it means that in master at the
moment we could potentially say move the
logic of generating the prompt on the
back end. The second step is of course
making LLM pluggable, right? because we
want potentially be able to say generate
this prompt in a slightly different way
depending on the LLM depending on a code
or depending if you plug let's say charg
or jin and so on and maybe even but
pluggable of course if you want to do on
the back end why not on the back end why
Google decided on the front end because
in that way you you can avoid the let's
say abuse lms can be very expensive at
the moment the providers a providers
what they do they basically give you the
LLM for free but that will end sooner or
later they cannot continue let's say in
losing 90% of the money every time that
you give them let's say some money for
the LLM so sooner or later they will
start charging us everything right and
we need to reduce that and last point of
course making sure that the review bot
will be aligned with your user
experience how many of you have used
cursor the ID the AI ID
He used it. That's good. Well done,
Martin. And the cursor is great because
uh instead of asking you to go to a
different UI, it has a sidebar on the
right where you can communicate in real
time with AI agent, right? And the LM
will give you suggestions. And the
concept that we are building is to
create an site on Garrett where you can
interact with the LM that will tell you
suggestion of what to fix. I say I found
a bug. wise you're doing review do you
want this and then it's going to be you
that you select what you want want to
become a review but then it's going to
be your review not the AI review so you
need to he will propose what to do but
then you will have to review it and
accept it and say that was a good
suggestion or that was not a good
suggestion or or maybe AI just didn't
understand the context right
so the next big thing that's not the end
of the story so Google actually has been
working behind the scenes
in building something brand new that is
called a Gary MCP server. Okay, this is
a brand new project. How many of you
know what is an MCP server? Okay, you
want to try who wants to try to define
what is an MCP server? Here we go. I
know is Sunday afternoon but you can who
wants to do it? You want to do it? Go
for it.
MCP is a protocol uh to let AI talk to
different kind of MCP server more or
less give the access to those servers.
Okay, that was excellent. Thank you very
much for that. So round of applause for
you because Sunday afternoon you are
still there on board which is good. H
why is so important because a lot of
companies now they want to integrate and
get more knowledge and more context to
the LMS and the AI agents. So what you
were saying is very true. So the initial
approach that has been implemented in
Gary is limited because they don't have
the context right and they want AI agent
to really understand the codebase and
being able to propose patches or to
integrate the knowledge that you've got
in the code with the knowledge they've
got in the issue tracker and do more.
Okay, Google has been working on that
internally for a very long time and they
have been working behind the scenes
without showcasing anything to us.
however now decided to go externally and
say we've done this and we donate to the
community and they say we used it is
useful maybe you can make use of it as
well so for the ones they are based in
Europe or next to Germany or next to
Munich to the Google headquarters so
next month so we are not just doing
Garrett user summit every year we
actually doing a smaller one every month
that is called Garrett meets. So if you
are not far from Munich where there are
the Google European headquarters there
and there is the Gary team. So finally
there is going to be an event organized
by Google where all the Gary team will
be there and all the Google team will be
there and uh they're going to show to us
what they've done with the MCP server.
So because of course we wanted also to
show what we have done. There's not that
much on AI but we done something. We
will also present what we've done on AI
on Gary. Yeah. So it you need to
register it's free and they also offer
dinner. It looks like Google has some
budget back which is good right so we
are really glad to see that. So if
you're around November 19th from 6:00 to
9:30 there will be this presentation of
Google about MCP and then questions.
Do you have any questions?
You want to ask something? No. Yeah. Go.
Go for it.
Well, this way of doing the uh AI review
where the human reviews it. I mean, I
imagine a lot of people would just press
submit with the generated code. C can
can we coil the coin the term human
washing? It's we're human washing the is
it too provocative? I think it's uh it's
quite likely that uh would be the
behavior and I think that's fine. That's
also interesting.
Yeah. No, I I definitely agree that
could be the danger that uh you just say
approve them all. But the point is the
because AI would generate so many
comments you just don't enable tickle
right at least you would have you will
need to go to the page to click them
all. To give you some examples some of
the customer they've been using AI for
doing automated reviews for years. they
were generating I was mentioning even
one million comments on a change
at least you if there is a human that
wants to take one million times
so
I will give you a medal right but at
least it will take time they will not
overload my server and I I hope that
this finger will just have a kind of
paralysis right
it feels like this approach
misunderstands the assignment a little
bit what we're trying to do with with
review of course there is the human
collaboration aspect where share
knowledge teach each other and there is
the prevent bad things from happening in
production and I think thinking about
them separately also
actually I don't know if it's
interesting but as an example with a
just classical neuronet network one can
classify um code changes and and try to
score the risk of types of modifications
that were made to the codebase and just
giving you a score is this a high high
risk change versus a low risk
There is actually I believe there was a
presentation from Shane in Mintosh about
that if you remember it was a few years
ago. So so the same professor that has
been helping us with the ghs research
he has been doing a research program uh
program exactly on that he was using AI
for doing a scoring of the risk of a
change. So maybe you can follow up with
I would love to speak with this guy
actually. Can I can I say one
controversial thought that I have?
So I think a lot of us use heristics. I
think it's natural as humans use
heristics for a lot of things that
includes code review. So I'm I'm looking
at a code pattern and in my experience I
recognize this is a dangerous pattern
and I speak about it and I think this is
this is AI. I mean this this is uh this
is what we try to encode in in networks.
So I thought how much of an accuracy can
and precision can one get
uh just using data that's out in the
open. So um before Chad GPT
team of mine and I trained a classical
neural network that is just a few
megabytes large
trying to predict will this pull request
or change get approved
uh or approved like without any
intervention and we scored 98%
uh precision. So being wrong 2% of the
time. So and and this is this is looking
instead of the diff looking at things
like how long would a particular
uh type of change stay without being
modified by somebody else or um the
patterns when you for instance you
create a change into a controller
without a migration in database etc etc.
You can you can you can encode it in in
in software
and you don't have to do the
collaboration part. You can just be on
the mechanical bit.
Yeah, that's interesting. It sounds
interesting as well. Yeah, absolutely.
And also you can have as you were
mentioning so you can do an initial
training of the neural network but then
that continues to learn. Yep. You can
have human feedback that will say no you
were wrong and then you continue to give
this learning then maybe giving inside
integrated with Gary UI the score
because at the moment we the only thing
that we give as a label is the size of
the change. So you've got Excel L but
that is not enough. Sometimes you've got
some small changes they're very high
risk some big changes they are just
rewriting the dock or whatever
formatting.
What do you train it on? Do you train it
on on just just the or just the diff or
are we looking at past incidents that
match this pattern etc. And if if you
have that in a data store somewhere.
Yeah, that would be nice. Yes.
Well, uh Uber did actually do this kind
of training as well uh to identify which
changes would pass a CI or not and then
schedule the changes in right order. One
of the most important part was not the
size of the committ which files changed.
It was who had written it.
A year later we talked to them again.
Turned out that they had they had to
disable that feature with who wrote it,
the commit of it. And I think the
management said that's not okay.
Okay. Anyone else? [snorts] No.
Okay. So, I really have to board my
flight and I want to thank you. So,
round of applause for everyone
[applause]
there. I don't know if the audio guys
are here. I wanted to say a round of
applause to them that they're not here,
but they did a fantastic job as well.
So, they will publish the recording. And
again, thank you Martin. Right.
[applause]
That stream was great. Thank you for
coming. So, if you are around, you you
guys are in Germany, right?
Some of the team are.
Yeah. So maybe if you want to pass a
word about the the AI meetup next month.
Yep. It's going to be in Munich. I don't
know how far for it is, but if it's not
for it, yeah, come and see us again.
Thank you. Thanks for coming.
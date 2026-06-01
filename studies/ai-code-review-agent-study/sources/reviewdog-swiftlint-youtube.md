---
applicable_dimensions:
  - "01"
  - "06"
  - "14"
---

# Automate GitHub PR Comments with Reviewdog + SwiftLint

**Source**: https://www.youtube.com/watch?v=Hexx8oWJCGg

## Transcript

If you are still merging pull requests
without automatic feedback, you're doing
it not correct. Let me show you how to
turn GitHub into your own code reviewing
teammate using review doc. Code reviews
take time. Reviewers need big style
issues and you only notice some mistake
after merging. But what if your pull
request reviewed itself before anyone
else did? That used to be my problem. I
would push code. CI would run test but
linting errors they slip through.
Reviewers had to waste time pointing out
formatting instead of focusing on logic.
So we updated our pipeline. We added
sweep lint and connected it with review
dog. Now linting errors don't just fail
the build, they show up as comments in
the full request itself.
Let's start adding the lint step to our
CI workflow. First, we need to add
permissions so review dog can write
comments directly to pull requests.
[Music]
Next, let's create a new job. This runs
in parallel with other jobs like build
and test. I will call it lint and run it
on macros.
[Music]
Now we need to set up review d. This
install the tool so we can pass lint
result into it.
[Music]
and then install Swift. I'm doing it
manually with homebrew, but you could
also use peer build action.
And last but not least, we run Swift
Link and pipe the results into Review
Dog. Review Dog then posts those results
back to GitHub as inline pull request
comments.
[Music]
Hey,
hey, hey.
[Music]
And that's it. We have wired up a new
link job that automatically runs on Mac
OS. check our swift code with swift link
and pipes the result back into GitHub
pull request as a comment using review.
[Music]
Here is what it looks like in action. I
pushed a pull request with a style
violation. Instead of waiting for a
teammate to catch it, review dog
instantly left a comment right on the
exact line. If you want to level up your
GitHub workflow, try adding review d to
your CI. Your teammate will thank you
later. And if you found this helpful,
subscribe for more GitHub automation
tips. Until next time, keep coding.
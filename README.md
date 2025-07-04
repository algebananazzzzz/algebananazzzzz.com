# Nocturnal Project

## Introduction

Nocturnal is a stylish and customizable portfolio site template built with GatsbyJS (React) and TailwindCSS. The project uses Github Actions to build the Gatsby site and deploy to Github Pages.

Please visit the [demo site](https://algebananazzzzz.github.io/NocturnalProject/) for a preview. Visit my [blog page](https://docs.algebananazzzzz.com/v/nocturnal-project) for detailed instructions on how to customize content.

## Features 

1. **Main feature:** Provides a content abstraction level where all content is sourced from YAML files. Because of this, individuals can create fully personalized and functional portfolio site within 10 minutes without touching code!

2. **CI/CD:** Using Github Actions, every commit will trigger an automation pipeline to build and deploy the site to Github Pages. No manual deployment steps are required.

## Prerequisites

There are no prerequisites in this project. However, if you want to develop and preview your portfolio locally, you'll need to download `GatsbyJS`.

1. Install Gatsby on your local machine using this [instructions](https://www.gatsbyjs.com/docs/tutorial/getting-started/part-0/).

2. After cloning the repository, within the directory, download required npm packages using this command.

```shell
npm install
```

3. Preview the deployment site with this command.

```shell
gatsby develop
```

## Installation 

1. To clone the repository, use this command.

```shell
git clone https://github.com/algebananazzzzz/NocturnalProject.git
```

2. Create a new repository in your GitHub account.

3. Remove the existing git origin.

```shell
git remote rm origin
```

4. Add the new repository as the new git origin.
```shell
git add remote origin https://github.com/<your_new_repo>.git
```

## Customization

Visit my [blog page](https://docs.algebananazzzzz.com/v/nocturnal-project) for detailed instructions on how to customize content.

## Deployment

1. Add and commit your changes

```shell
git add -A
git commit -m "Initial Commit"
```

2. Set checkout branch to main

```shell
git checkout -b main
```

3. Push to remote origin

```shell
git remote set-url origin https://github.com/<your_new_repo>.git
git push --set-upstream origin main
```
## License and Contribution

This project is licensed under the MIT License. See the [LICENSE](LICENSE.txt) file for more details.

We welcome contributions to this project! Whether it's reporting a bug, discussing a feature, or submitting a pull request, your involvement is appreciated.
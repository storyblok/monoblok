#!/bin/bash
set -e

# Make sure jq is installed
if ! command -v jq &> /dev/null; then
    echo "Error: jq is required but not installed. Please install jq first."
    echo "You can install it with: brew install jq"
    exit 1
fi

# Read the manifest file
manifest_file="repo-manifest.json"
if [ ! -f "$manifest_file" ]; then
    echo "Error: $manifest_file not found."
    exit 1
fi

# Process each package in the manifest
jq -r 'to_entries | .[] | @json' "$manifest_file" | while read -r package_json; do
    # Extract package details
    package_name=$(echo "$package_json" | jq -r '.key')
    repo=$(echo "$package_json" | jq -r '.value.repo')
    branch=$(echo "$package_json" | jq -r '.value.branch')
    path=$(echo "$package_json" | jq -r '.value.path')
    
    # Form the GitHub URL
    repo_url="https://github.com/$repo.git"
    
    # Create a remote name based on the package name
    # Normalizing remote name to remove @ but replace / with -
    remote_name="$(echo "$package_name" | sed 's/@//g' | sed 's/\//-/g' | tr '.' '-')"
    
    # Add the remote
    echo "Adding remote '$remote_name' for $package_name..."
    if git remote | grep -q "^$remote_name$"; then
        echo "Remote $remote_name already exists, updating URL..."
        git remote set-url "$remote_name" "$repo_url"
    else
        git remote add "$remote_name" "$repo_url"
    fi
    
    # Determine the prefix (destination) path in the monorepo
    prefix="$path"
    
    echo "Adding subtree for $package_name from $repo_url ($branch)..."
    
    # Add the subtree
    git subtree add --prefix="$prefix" "$repo_url" "$branch"
    
    echo "Completed adding $package_name"
    echo "-----------------------------------"
done

echo "All subtrees have been added successfully!"
echo ""
echo "To update a package in the future, run:"
echo "git fetch <remote-name>"
echo "git subtree pull --prefix=<path> <remote-name> <branch>"
echo ""
echo "For example:"
echo "git fetch storyblok-js-client"
echo "git subtree pull --prefix=packages/storyblok-js-client storyblok-js-client main" 

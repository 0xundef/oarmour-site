"use client";
import { Button } from "@/components/ui/button";
import GoogleSignInButton from "../google-auth-button";
import GithubSignInButton from "../github-auth-button";

export default function UserAuthForm() {
  return (
    <>
      <div className="flex flex-col gap-4">
        <GoogleSignInButton />
        
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">
              or
            </span>
          </div>
        </div>

        <Button 
          variant="outline" 
          className="w-full" 
          onClick={() => {
            // Placeholder for email login logic if needed
          }}
        >
           <span className="mr-2">✉️</span> Continue with Email
        </Button>

        <GithubSignInButton />
        
        <Button variant="outline" className="w-full">
          Skip for now
        </Button>
      </div>
    </>
  );
}

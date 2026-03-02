import { TooltipProvider } from "@radix-ui/react-tooltip";
import {
  Button,
  Flex,
  globalCss,
  rawTheme,
  Text,
  theme,
} from "@webstudio-is/design-system";
import { GithubIcon, WebstudioIcon } from "@webstudio-is/icons";
import { Form } from "@remix-run/react";
import { authPath } from "~/shared/router-utils";
import { SecretLogin } from "./secret-login";

const GoogleColoredIcon = ({ size = 22 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 48 48">
    <path
      fill="#EA4335"
      d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.7 17.74 9.5 24 9.5z"
    />
    <path
      fill="#4285F4"
      d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
    />
    <path
      fill="#FBBC05"
      d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
    />
    <path
      fill="#34A853"
      d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
    />
    <path fill="none" d="M0 0h48v48H0z" />
  </svg>
);

const globalStyles = globalCss({
  body: {
    margin: 0,
    overflow: "hidden",
  },
});

export type LoginProps = {
  errorMessage?: string;
  isGithubEnabled?: boolean;
  isGoogleEnabled?: boolean;
  isSecretLoginEnabled?: boolean;
};

export const Login = ({
  errorMessage,
  isGithubEnabled,
  isGoogleEnabled,
  isSecretLoginEnabled,
}: LoginProps) => {
  globalStyles();
  return (
    <Flex
      align="center"
      justify="center"
      css={{
        height: "100vh",
        background: theme.colors.backgroundPanel,
      }}
    >
      <Flex
        direction="column"
        align="center"
        gap="6"
        css={{
          width: theme.spacing[35],
          minWidth: theme.spacing[20],
          padding: theme.spacing[17],
          borderRadius: theme.spacing[5],
          [`@media (min-width: ${rawTheme.spacing[35]})`]: {
            backgroundColor: `rgba(255, 255, 255, 0.5)`,
          },
        }}
      >
        <WebstudioIcon size={48} />
        <Text variant="brandSectionTitle" as="h1" align="center">
          Welcome to Web Lab
        </Text>

        <TooltipProvider>
          <Flex direction="column" gap="3" css={{ width: "100%" }}>
            <Form method="post" reloadDocument style={{ display: "contents" }}>
              <Button
                disabled={isGoogleEnabled === false}
                prefix={<GoogleColoredIcon size={22} />}
                color="ghost"
                css={{
                  border: `1px solid ${theme.colors.borderDark}`,
                  height: theme.spacing[15],
                }}
                formAction={authPath({ provider: "google" })}
              >
                Sign in with Google
              </Button>
              <Button
                disabled={isGithubEnabled === false}
                prefix={<GithubIcon size={22} fill="currentColor" />}
                color="ghost"
                css={{
                  border: `1px solid ${theme.colors.borderDark}`,
                  height: theme.spacing[15],
                }}
                formAction={authPath({ provider: "github" })}
              >
                Sign in with GitHub
              </Button>
            </Form>
            {isSecretLoginEnabled && <SecretLogin />}
          </Flex>
        </TooltipProvider>
        {errorMessage ? (
          <Text align="center" color="destructive">
            {errorMessage}
          </Text>
        ) : null}
      </Flex>
    </Flex>
  );
};

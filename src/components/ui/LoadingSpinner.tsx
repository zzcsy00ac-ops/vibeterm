import { Spinner } from '@radix-ui/themes';
import { Flex, Text } from '@radix-ui/themes';

interface LoadingSpinnerProps {
  message?: string;
}

export function LoadingSpinner({ message = '加载中...' }: LoadingSpinnerProps) {
  return (
    <Flex
      direction="column"
      align="center"
      justify="center"
      style={{ height: '100vh', gap: '16px' }}
    >
      <Spinner size="3" />
      <Text color="gray">{message}</Text>
    </Flex>
  );
}

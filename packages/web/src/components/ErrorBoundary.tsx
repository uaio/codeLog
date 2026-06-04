import { Component, type ReactNode, type ErrorInfo } from 'react';
import { WarningOutlined } from '@ant-design/icons';
import { Result, Button } from 'antd';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[codeLog Web] Uncaught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Result
          status="warning"
          icon={<WarningOutlined />}
          title="Something went wrong"
          subTitle={this.state.error?.message}
          extra={
            <Button
              type="primary"
              onClick={() => this.setState({ hasError: false, error: null })}
            >
              Try Again
            </Button>
          }
          style={{
            height: '100vh',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            backgroundColor: '#1a1a2e',
          }}
        />
      );
    }

    return this.props.children;
  }
}

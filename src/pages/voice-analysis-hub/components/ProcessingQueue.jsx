import React from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';


const ProcessingQueue = ({ items = [], onItemComplete }) => {

  const getStatusIcon = (status) => {
    switch (status) {
      case 'processing':
        return { name: 'Loader', color: 'var(--color-primary)' };
      case 'completed':
        return { name: 'CheckCircle', color: 'var(--color-success)' };
      case 'failed':
        return { name: 'XCircle', color: 'var(--color-destructive)' };
      default:
        return { name: 'Clock', color: 'var(--color-muted-foreground)' };
    }
  };

  const getSentimentColor = (sentiment) => {
    switch (sentiment?.toLowerCase()) {
      case 'positive':
        return 'text-success';
      case 'negative':
        return 'text-destructive';
      default:
        return 'text-warning';
    }
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs?.toString()?.padStart(2, '0')}`;
  };

  const getEstimatedTime = (progress) => {
    const remaining = 100 - progress;
    const seconds = Math.ceil((remaining / 5) * 1);
    return seconds > 60 ? `${Math.ceil(seconds / 60)}m` : `${seconds}s`;
  };

  if (items?.length === 0) {
    return (
      <div className="bg-card rounded-lg border border-border p-8">
        <div className="flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
            <Icon name="ListMusic" size={32} color="var(--color-muted-foreground)" />
          </div>
          <h3 className="text-lg font-medium text-foreground mb-2">No files in queue</h3>
          <p className="text-sm text-muted-foreground">
            Upload audio files or start recording to begin analysis
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-lg border border-border">
      <div className="p-6 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 bg-accent/10 rounded-lg">
              <Icon name="ListMusic" size={20} color="var(--color-accent)" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Processing Queue</h2>
              <p className="text-sm text-muted-foreground">
                {items?.filter(i => i?.status === 'processing')?.length} processing • {items?.filter(i => i?.status === 'completed')?.length} completed
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" iconName="RefreshCw">
            Refresh
          </Button>
        </div>
      </div>
      <div className="divide-y divide-border">
        {items?.map((item) => {
          const statusIcon = getStatusIcon(item?.status);
          return (
            <div key={item?.id} className="p-6 hover:bg-muted/30 transition-colors">
              <div className="flex items-start gap-4">
                <div className={`mt-1 ${item?.status === 'processing' ? 'animate-spin' : ''}`}>
                  <Icon name={statusIcon?.name} size={20} color={statusIcon?.color} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium text-foreground truncate">
                        {item?.fileName}
                      </h3>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        {item?.duration && (
                          <span className="flex items-center gap-1">
                            <Icon name="Clock" size={12} />
                            {formatDuration(item?.duration)}
                          </span>
                        )}
                        {item?.fileSize && (
                          <span className="flex items-center gap-1">
                            <Icon name="HardDrive" size={12} />
                            {(item?.fileSize / (1024 * 1024))?.toFixed(2)} MB
                          </span>
                        )}
                      </div>
                    </div>

                    {item?.status === 'completed' && item?.sentimentScore && (
                      <div className="flex flex-col items-end">
                        <span className={`text-sm font-semibold ${getSentimentColor(item?.sentiment)}`}>
                          {item?.sentiment}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          Score: {item?.sentimentScore}%
                        </span>
                      </div>
                    )}
                  </div>

                  {item?.status === 'processing' && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Processing...</span>
                        <span className="text-primary font-medium">
                          {item?.progress}% • ~{getEstimatedTime(item?.progress)} remaining
                        </span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-primary transition-all duration-300"
                          style={{ width: `${item?.progress}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {item?.status === 'completed' && (
                    <div className="flex items-center gap-2 mt-3">
                      <Button variant="outline" size="xs" iconName="FileText">
                        View Transcript
                      </Button>
                      <Button variant="outline" size="xs" iconName="BarChart3">
                        Analysis
                      </Button>
                      <Button variant="ghost" size="xs" iconName="Download">
                        Export
                      </Button>
                    </div>
                  )}

                  {item?.status === 'failed' && (
                    <div className="mt-2 p-3 bg-destructive/10 rounded-lg">
                      <p className="text-xs text-destructive">
                        Processing failed. Please try uploading the file again.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ProcessingQueue;
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

interface PathStatsProps {
    stats?: { pathCount: number; totalLength: number; travelLength?: number } | null;
    feedRate?: number; // mm/min
    travelRate?: number; // mm/min
}

export default function PathStats({ stats, feedRate = 1000, travelRate = 3000 }: PathStatsProps) {
    if (!stats) {
        return null;
    }

    const { pathCount, totalLength, travelLength = 0 } = stats;
    const estimatedDrawMinutes = totalLength / feedRate;
    const estimatedTravelMinutes = travelLength / travelRate;
    const estimatedSeconds = Math.round((estimatedDrawMinutes + estimatedTravelMinutes) * 60);

    const formatTime = (seconds: number): string => {
        if (seconds < 60) {
            return `${seconds}s`;
        } else if (seconds < 3600) {
            const mins = Math.floor(seconds / 60);
            const secs = seconds % 60;
            return `${mins}m ${secs}s`;
        } else {
            const hours = Math.floor(seconds / 3600);
            const mins = Math.floor((seconds % 3600) / 60);
            return `${hours}h ${mins}m`;
        }
    };

    return (
        <Card>
            <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Path Statistics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Length:</span>
                    <span className="font-medium">{totalLength.toFixed(2)} mm</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-muted-foreground">Path Count:</span>
                    <span className="font-medium">{pathCount}</span>
                </div>
                {travelLength > 0 && (
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Travel Length:</span>
                        <span className="font-medium">{travelLength.toFixed(2)} mm</span>
                    </div>
                )}
                <div className="flex justify-between">
                    <span className="text-muted-foreground">Est. Draw Time:</span>
                    <span className="font-medium">{formatTime(estimatedSeconds)}</span>
                </div>
                <div className="text-xs text-muted-foreground mt-2">
                    @ {feedRate} mm/min feed rate
                </div>
            </CardContent>
        </Card>
    );
}


export function formatTimeSeconds(seconds: number | undefined, showSeconds: boolean = false): string {
    if (!seconds) {
        return '';
    }
    let h = Math.floor(seconds / 3600);
    let d = Math.floor(h / 24);
    h = h - d*24;
    let m = Math.floor(seconds % 3600 / 60);
    let s = Math.floor(seconds % 3600 % 60);

    let parts = [];

    if (d > 0) {
        parts.push(d + 'D');
    }

    if (h > 0) {
        parts.push(h + 'H');
    }

    if (m > 0) {
        parts.push(m + 'M');
    }

    if ((s > 0) && (showSeconds || (seconds < 60))) {
        parts.push(s + 'S');
    }

    if (parts.length === 0) {
        return '0S';
    } else {
        return parts.join(' ');
    }
}


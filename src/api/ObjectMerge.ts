function isObject(item: any): boolean {
    return (item && typeof item === 'object' && !Array.isArray(item));
}

export function mergeDeep(target: any, source: any | undefined, skipMerge?: string[]): any {
    if (!source) {
        return target;
    }

    if (isObject(target) && isObject(source)) {
        for (const key in source) {
            if (skipMerge && skipMerge.includes(key)) {
                continue;
            }
            if (isObject(source[key])) {
                if (!target[key]) Object.assign(target, { [key]: {} });
                mergeDeep(target[key], source[key]);
            } else if (Array.isArray(source[key])) {
                if (!target[key]) {
                    Object.assign(target, { [key]: source[key] });
                } else {
                    // For arrays, we need to look at ids
                    source[key].forEach((element: any) => {
                        if (!element.id) {
                            target[key].push(element);
                        } else {
                            let current = target[key].find((it: any) => it.id === element.id);
                            if (current) {
                                mergeDeep(current, element);
                            } else {
                                target[key].push(element);
                            }
                        }
                    });
                }
            } else {
                Object.assign(target, { [key]: source[key] });
            }
        }
    }

    return target;
}

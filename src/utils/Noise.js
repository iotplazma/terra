export default class Noise {
    constructor(seed = Math.random() * 999999) {
        this.seed = seed;
        this.gradients = {};
        this.PERLIN_YWRAPB = 4;
        this.PERLIN_YWRAP = 1 << this.PERLIN_YWRAPB;
        this.PERLIN_ZWRAPB = 8;
        this.PERLIN_ZWRAP = 1 << this.PERLIN_ZWRAPB;
        this.PERLIN_SIZE = 4095;
        
        this.perlin = new Array(this.PERLIN_SIZE + 1);
        for (let i = 0; i <= this.PERLIN_SIZE; i++) {
            this.perlin[i] = Math.random();
        }
    }

    // Perlin шум 2D
    perlin2(x, y) {
        let xi = Math.floor(x);
        let yi = Math.floor(y);
        
        let xf = x - xi;
        let yf = y - yi;
        
        let rxf, ryf;
        
        let r = this.fade(xf);
        let t = this.fade(yf);
        
        xi = xi & this.PERLIN_SIZE;
        yi = yi & this.PERLIN_SIZE;
        
        let n1 = this.perlin[xi] + yi;
        let n2 = this.perlin[xi + 1] + yi;
        
        // Вычисление шума
        let noise = this.lerp(
            t,
            this.lerp(r, this.grad(this.perlin[n1 & this.PERLIN_SIZE], xf, yf),
                     this.grad(this.perlin[n2 & this.PERLIN_SIZE], xf - 1, yf)),
            this.lerp(r, this.grad(this.perlin[(n1 + 1) & this.PERLIN_SIZE], xf, yf - 1),
                     this.grad(this.perlin[(n2 + 1) & this.PERLIN_SIZE], xf - 1, yf - 1))
        );
        
        return noise;
    }

    // Perlin шум 3D
    perlin3(x, y, z) {
        let xi = Math.floor(x);
        let yi = Math.floor(y);
        let zi = Math.floor(z);
        
        let xf = x - xi;
        let yf = y - yi;
        let zf = z - zi;
        
        xi = xi & this.PERLIN_SIZE;
        yi = yi & this.PERLIN_SIZE;
        zi = zi & this.PERLIN_SIZE;
        
        let u = this.fade(xf);
        let v = this.fade(yf);
        let w = this.fade(zf);
        
        // Вычисление 8 углов куба
        let n1 = this.perlin[xi] + yi;
        let n2 = this.perlin[xi + 1] + yi;
        
        let n11 = this.perlin[n1] + zi;
        let n12 = this.perlin[n1 + 1] + zi;
        let n21 = this.perlin[n2] + zi;
        let n22 = this.perlin[n2 + 1] + zi;
        
        // Интерполяция
        return this.lerp(w,
            this.lerp(v,
                this.lerp(u,
                    this.grad(this.perlin[n11 & this.PERLIN_SIZE], xf, yf, zf),
                    this.grad(this.perlin[n21 & this.PERLIN_SIZE], xf - 1, yf, zf)),
                this.lerp(u,
                    this.grad(this.perlin[n12 & this.PERLIN_SIZE], xf, yf - 1, zf),
                    this.grad(this.perlin[n22 & this.PERLIN_SIZE], xf - 1, yf - 1, zf))),
            this.lerp(v,
                this.lerp(u,
                    this.grad(this.perlin[(n11 + 1) & this.PERLIN_SIZE], xf, yf, zf - 1),
                    this.grad(this.perlin[(n21 + 1) & this.PERLIN_SIZE], xf - 1, yf, zf - 1)),
                this.lerp(u,
                    this.grad(this.perlin[(n12 + 1) & this.PERLIN_SIZE], xf, yf - 1, zf - 1),
                    this.grad(this.perlin[(n22 + 1) & this.PERLIN_SIZE], xf - 1, yf - 1, zf - 1)))
        );
    }

    // Octave шум (фрактальный Брауновское движение)
    fbm(x, y, octaves = 4, persistence = 0.5, lacunarity = 2.0) {
        let value = 0;
        let amplitude = 1;
        let frequency = 1;
        let maxValue = 0;
        
        for (let i = 0; i < octaves; i++) {
            value += this.perlin2(x * frequency, y * frequency) * amplitude;
            maxValue += amplitude;
            amplitude *= persistence;
            frequency *= lacunarity;
        }
        
        return value / maxValue;
    }

    // Ridged multi-fractal шум
    ridged(x, y, octaves = 4, lacunarity = 2.0, gain = 0.5, offset = 1.0) {
        let value = 0;
        let frequency = 1;
        let amplitude = 0.5;
        let prev = 1.0;
        
        for (let i = 0; i < octaves; i++) {
            let n = this.perlin2(x * frequency, y * frequency);
            n = Math.abs(n);
            n = offset - n;
            n *= n;
            n *= prev;
            
            value += n * amplitude;
            prev = n;
            frequency *= lacunarity;
            amplitude *= gain;
        }
        
        return value;
    }

    // Simplex шум 2D (упрощенная версия)
    simplex2(x, y) {
        const F2 = 0.5 * (Math.sqrt(3) - 1);
        const G2 = (3 - Math.sqrt(3)) / 6;
        
        let s = (x + y) * F2;
        let i = Math.floor(x + s);
        let j = Math.floor(y + s);
        
        let t = (i + j) * G2;
        let X0 = i - t;
        let Y0 = j - t;
        let x0 = x - X0;
        let y0 = y - Y0;
        
        let i1, j1;
        if (x0 > y0) {
            i1 = 1;
            j1 = 0;
        } else {
            i1 = 0;
            j1 = 1;
        }
        
        let x1 = x0 - i1 + G2;
        let y1 = y0 - j1 + G2;
        let x2 = x0 - 1 + 2 * G2;
        let y2 = y0 - 1 + 2 * G2;
        
        let n0, n1, n2;
        
        let t0 = 0.5 - x0 * x0 - y0 * y0;
        if (t0 < 0) n0 = 0;
        else {
            t0 *= t0;
            n0 = t0 * t0 * this.dot2(this.grad3[i & 255][j & 255], x0, y0);
        }
        
        let t1 = 0.5 - x1 * x1 - y1 * y1;
        if (t1 < 0) n1 = 0;
        else {
            t1 *= t1;
            n1 = t1 * t1 * this.dot2(this.grad3[(i + i1) & 255][(j + j1) & 255], x1, y1);
        }
        
        let t2 = 0.5 - x2 * x2 - y2 * y2;
        if (t2 < 0) n2 = 0;
        else {
            t2 *= t2;
            n2 = t2 * t2 * this.dot2(this.grad3[(i + 1) & 255][(j + 1) & 255], x2, y2);
        }
        
        return 70 * (n0 + n1 + n2);
    }

    // Вспомогательные функции
    fade(t) {
        return t * t * t * (t * (t * 6 - 15) + 10);
    }

    lerp(t, a, b) {
        return a + t * (b - a);
    }

    grad(hash, x, y, z = 0) {
        switch (hash & 15) {
            case 0: return  x + y;
            case 1: return -x + y;
            case 2: return  x - y;
            case 3: return -x - y;
            case 4: return  x + z;
            case 5: return -x + z;
            case 6: return  x - z;
            case 7: return -x - z;
            case 8: return  y + z;
            case 9: return -y + z;
            case 10: return  y - z;
            case 11: return -y - z;
            case 12: return  y + x;
            case 13: return -y + z;
            case 14: return  y - x;
            case 15: return -y - z;
            default: return 0;
        }
    }

    dot2(g, x, y) {
        return g[0] * x + g[1] * y;
    }

    dot3(g, x, y, z) {
        return g[0] * x + g[1] * y + g[2] * z;
    }

    // Таблицы для Simplex шума
    grad3 = [
        [1,1,0],[-1,1,0],[1,-1,0],[-1,-1,0],
        [1,0,1],[-1,0,1],[1,0,-1],[-1,0,-1],
        [0,1,1],[0,-1,1],[0,1,-1],[0,-1,-1]
    ];

    p = [
        151,160,137,91,90,15,131,13,201,95,96,53,194,233,7,225,140,36,103,30,
        69,142,8,99,37,240,21,10,23,190,6,148,247,120,234,75,0,26,197,62,94,
        252,219,203,117,35,11,32,57,177,33,88,237,149,56,87,174,20,125,136,
        171,168,68,175,74,165,71,134,139,48,27,166,77,146,158,231,83,111,229,
        122,60,211,133,230,220,105,92,41,55,46,245,40,244,102,143,54,65,25,
        63,161,1,216,80,73,209,76,132,187,208,89,18,169,200,196,135,130,116,
        188,159,86,164,100,109,198,173,186,3,64,52,217,226,250,124,123,5,
        202,38,147,118,126,255,82,85,212,207,206,59,227,47,16,58,17,182,189,
        28,42,223,183,170,213,119,248,152,2,44,154,163,70,221,153,101,155,
        167,43,172,9,129,22,39,253,19,98,108,110,79,113,224,232,178,185,112,
        104,218,246,97,228,251,34,242,193,238,210,144,12,191,179,162,241,81,
        51,145,235,249,14,239,107,49,192,214,31,181,199,106,157,184,84,204,
        176,115,121,50,45,127,4,150,254,138,236,205,93,222,114,67,29,24,72,
        243,141,128,195,78,66,215,61,156,180
    ];

    // Создание карты высот
    generateHeightmap(width, height, scale = 100, octaves = 4) {
        const map = new Array(height);
        
        for (let y = 0; y < height; y++) {
            map[y] = new Array(width);
            for (let x = 0; x < width; x++) {
                const nx = x / width - 0.5;
                const ny = y / height - 0.5;
                
                // Комбинация разных типов шума
                let value = this.fbm(nx * scale, ny * scale, octaves);
                value += this.ridged(nx * scale * 2, ny * scale * 2, 2) * 0.3;
                
                map[y][x] = (value + 1) / 2; // Нормализация к 0-1
            }
        }
        
        return map;
    }

    // Генерация температуры/влажности
    generateBiomeMap(width, height, scale = 50) {
        const temp = this.generateHeightmap(width, height, scale, 3);
        const humidity = this.generateHeightmap(width, height, scale * 1.3, 3);
        
        const biomes = new Array(height);
        
        for (let y = 0; y < height; y++) {
            biomes[y] = new Array(width);
            for (let x = 0; x < width; x++) {
                const t = temp[y][x];
                const h = humidity[y][x];
                
                // Определение биома по температуре и влажности
                if (t < 0.3) {
                    biomes[y][x] = h < 0.4 ? 'tundra' : 'taiga';
                } else if (t < 0.6) {
                    if (h < 0.3) biomes[y][x] = 'plains';
                    else if (h < 0.6) biomes[y][x] = 'forest';
                    else biomes[y][x] = 'swamp';
                } else {
                    if (h < 0.2) biomes[y][x] = 'desert';
                    else if (h < 0.5) biomes[y][x] = 'savanna';
                    else biomes[y][x] = 'jungle';
                }
            }
        }
        
        return biomes;
    }
}
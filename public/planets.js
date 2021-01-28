class Planet {
    constructor(x, y, r, c, dx, dy) {
        this.x = x;
        this.y = y;
        this.r = r;
        this.m = r * r;
        this.c = c;
        this.dx = dx;
        this.dy = dy;
        this.dead = false;
    }

    draw() {
        push()
        stroke(this.c)
        fill(this.c)
        //text(this.dx.toFixed(2), this.x, this.y)
        circle(this.x, this.y, this.r)
        pop()
    }

    mark_dead() {
        this.dead = true
    }
}

class FixedMass {
    constructor(x, y, r, c) {
        this.x = x;
        this.y = y;
        this.r = r;
        this.m = r * r;
        this.c = c;
    }

    draw() {
        circle(this.x, this.y, this.r)
    }
}

/* Given two objects with x, y coordinates calculate squared cartesian distance */
let get_distance_sq = function(a, b) {
    return Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2)
}

const SEPARATOR = '_'

class PlanetSystem {
    constructor(g, resolution=2) {
        this.g = g;
        this.resolution = resolution;
        this.planets = [];
        this.fixedMasses = {};
    }

    add_planet(p) {
        p.id = this.planets.length
        this.planets.push(p)
    }

    /* Add quantity q of fixed mass to the coordinates x, y */
    add_fixed_mass(x, y, q) {
        // All the fixed masses exist on a grid of size this.resolution
        // Store the fixed masses as a dict of serialized coordinates => object
        // This is so that we have O(1) lookup by coordinate as well as O(N) lookup of the list of masses
        // because we don't want to add a ton of overlapping objects all the time
        if (!x || !y || !q) {
            return
        }
        let gridX = Math.round(x / this.resolution)
        let gridY = Math.round(y / this.resolution)
        let lookup = `${gridX}${SEPARATOR}${gridY}`
        // TODO probably should merge and/or decay these guys periodically
        if (!(lookup in this.fixedMasses)) {
            this.fixedMasses[lookup] = {
                m: 0,
                x: gridX * this.resolution,
                y: gridY * this.resolution,
            }
        }
        this.fixedMasses[lookup].m += q
        this.fixedMasses[lookup].r = Math.sqrt(this.fixedMasses[lookup].m)
    }

    /* Step all planets according to gravitational constant G */
    step() {
        // first handle collisions
        for(let i = 0; i < this.planets.length; i++) {
            let planet = this.planets[i]
            for(const lookup in this.fixedMasses) {
                // calculate force exerted on planet i by planet j
                const mass = this.fixedMasses[lookup]
                if (mass < 1) {
                    continue;
                }
                const dist_sq = get_distance_sq(planet, mass)
                const dist = Math.sqrt(dist_sq)
                // let f = g * this.planets[i].m * this.planets[j].m / dist_sq
                if (dist < planet.r || dist < mass.r) {
                    continue;
                }
                //const a = this.g * mass.m / dist_sq
                const a_dist = this.g * mass.m / dist_sq / dist
                // acceleration components are proportional to distances
                const a_x = a_dist * (mass.x - planet.x)
                const a_y = a_dist * (mass.y - planet.y)
                if (a_x && a_y) {
                    planet.dx += a_x
                    planet.dy += a_y
                }
            }
            let spd = Math.sqrt(planet.dx ** planet.dx + planet.dy ** planet.dy)
            if (spd > 5) {
                planet.dx = planet.dx * 5 / spd
                planet.dy = planet.dy * 5 / spd
            }
            planet.x += planet.dx
            planet.y += planet.dy
            planet.dx *= 0.9999
            planet.dy *= 0.9999
            /*
            if (planet.x > 1024) {
                planet.x = 0
            } 
            if (planet.y > 1024) {
                planet.y = 0
            } 
            if (planet.x < 0) {
                planet.x = 1024
            } 
            if (planet.y < 0) {
                planet.y = 1024
            }
            */
        }

        for(const lookup in this.fixedMasses) {
            this.fixedMasses[lookup].m -= this.fixedMasses[lookup].r  / 8
            this.fixedMasses[lookup].r = Math.sqrt(this.fixedMasses[lookup].m)
        }
        this.fixedMasses = Object.fromEntries(Object.entries(this.fixedMasses).filter(([k,v]) => v.m > 0));

    }

    draw() {
        push()
        for(let i in this.fixedMasses) {
            let mass = this.fixedMasses[i]
            // draw 
            // p5 suks for drawing lots of things at once, use the canvas API directly
            drawingContext.moveTo(mass.x, mass.y)
            drawingContext.arc(mass.x, mass.y, mass.r, 0, 2 * Math.PI, false);
            //circle(mass.x, mass.y, mass.r)
        }
        drawingContext.fillStyle = '#aaa';
        drawingContext.fill();
        pop()
        push()
        stroke('black')
        fill('black')
        for(let i = 0; i < this.planets.length; i++) {
            this.planets[i].draw()
        }
        pop()
    }

    sendOsc() {

        console.log('sending osc')
        for(let planet of this.planets) {
            // Convert planet properties to OSC messages for Max to control Ableton with
            // Parameters: distance from center, raw speed, angle of travel? lets start there

            let dist = get_distance_sq(planet, {x: 512, y:512}) ** 0.25
            let speed = Math.sqrt(planet.dx**2 + planet.dy**2)
            let theta = 0
            if (planet.dy != 0) {
                theta = Math.atan(planet.dx/planet.dy)
            } else if (planet.dx < 0) {
                theta = Math.PI
            } 
            let volume = Math.round(constrain(map(dist, 0, 100, 100, 40), 0, 100))

            let saturator = Math.round(constrain(map(Math.abs(planet.dx), 0, 4.0, 36, 96), 24, 96))
            let amp = Math.round(constrain(map(Math.abs(planet.dy), 0, 4.0, 1, 48), 1, 64))
            let osc3freq = Math.round(constrain(map(theta, 0, Math.PI * 2, 10, 101), 1, 100))
            let filterfreq = Math.round(constrain(map(speed, 0, 5, 100, 127), 100, 127))
            let data = {
                volume: 100,
                osc1freq: saturator,
                osc2freq: amp,
                osc3freq: osc3freq,
                filterfreq: filterfreq,
            }
            socket.emit('data', data)

            // C D E G B
            let n = [0, 2, 4, 7, 11]
            n = n.map(x => x + 30)
            n = n.concat(n.map(x => x + 12))
            n = n.concat(n.map(x => x + 24))
            n = n.concat(n.map(x => x + 48))
            let nIndex = Math.round(constrain(map(theta, 0, Math.PI, 0, n.length), 0, n.length))
            let newNote = n[nIndex]
            if (newNote !== planet.curNote) {
                socket.emit('midi', {
                    midiNote: planet.curNote,
                    midiVel: 0,
                });
                socket.emit('midi', {
                    midiNote: newNote,
                    midiVel: 100,
                });
                planet.curNote = newNote
            }
           
        }
    }
}
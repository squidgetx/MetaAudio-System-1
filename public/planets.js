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
        push()
        stroke(this.c)
        fill(this.c)
        //text(this.dx.toFixed(2), this.x, this.y)
        circle(this.x, this.y, this.r)
        pop()
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
        /*
        for(let i = 0; i < this.planets.length; i++) {
            for(let j = 0; j < this.planets.length; j++) {
                if (i == j) {
                    continue;
                }
                if (this.planets[i].dead || this.planets[j].dead) {
                    continue;
                }
                let dist_sq = get_distance_sq(this.planets[i], this.planets[j])
                if (Math.sqrt(dist_sq) < (this.planets[i].r + this.planets[j].r)) {
                  
                }
            }
        }
        */

        for(let i = 0; i < this.planets.length; i++) {
            let planet = this.planets[i]
            for(let lookup in this.fixedMasses) {
                // calculate force exerted on planet i by planet j
                let mass = this.fixedMasses[lookup]
                let dist_sq = get_distance_sq(planet, mass)
                let dist = Math.sqrt(dist_sq)
                // let f = g * this.planets[i].m * this.planets[j].m / dist_sq
                if (dist < planet.r || dist < mass.r) {
                    continue;
                }
                let a = this.g * mass.m / dist_sq
                // acceleration components are proportional to distances
                let a_x = a / Math.sqrt(dist_sq) * (mass.x - planet.x)
                let a_y = a / Math.sqrt(dist_sq) * (mass.y - planet.y)
                if (a_x && a_y) {
                    planet.dx += a_x
                    planet.dy += a_y
                }
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
        this.planets = this.planets.filter(a => a.dead == false)

        for(let lookup in this.fixedMasses) {
            this.fixedMasses[lookup].m -= this.fixedMasses[lookup].r ** 1.1 / 4
            this.fixedMasses[lookup].r = Math.sqrt(this.fixedMasses[lookup].m)
        }
        this.fixedMasses = Object.fromEntries(Object.entries(this.fixedMasses).filter(([k,v]) => v.m > 0));

    }

    draw() {
        for(let i in this.fixedMasses) {
            let mass = this.fixedMasses[i]
            // draw 
            push()
            stroke('red')
            fill('red')
            circle(mass.x, mass.y, mass.r)
            pop()
        }
        for(let i = 0; i < this.planets.length; i++) {
            this.planets[i].draw()
        }
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

            let osc1freq = Math.round(constrain(map(planet.dx, 4.0, -4.0, 1, 100), 1, 100))
            let osc2freq = Math.round(constrain(map(planet.dy, -2.0, 2.0, 1, 110), 1, 110))
            let osc3freq = Math.round(constrain(map(theta, 0, Math.PI * 2, 1, 101), 1, 100))
            let filterfreq = Math.round(constrain(map(speed, 0, 5, 20, 100), 10, 100))
            socket.emit('data', {
                volume: 100,
                osc1freq: osc1freq,
                osc2freq: osc2freq,
                osc3freq: osc3freq,
                filterfreq: filterfreq,
            })
            
            
           
           
           
        }
    }
}
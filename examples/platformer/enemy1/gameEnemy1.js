'use strict';

/* enemy sounds
hunting: zzfx(...[1.5,-0.25,,.07,.23,.25,,4.5,5,,,.12,.08,,17.1,,,.97,.18,1,505]);
laughing: zzfx(...[1.5,-0.25,440,.07,.31,.44,,4.5,5,,,,.08,,15,,,.97,.12,,505]);
low: zzfx(...[1.5,-0.25,65.40639,.07,.23,.25,,4.5,5,,,.12,.08,,17.1,,,.97,.18,1,505]); // Powerup 212
*/

const sound_enemy_hunting = new Sound([1.5,-0.25,,.07,.23,.25,,4.5,5,,,.12,.08,,17.1,,,.97,.18,1,505]);
const sound_enemy_laughing = new Sound([1.5,-0.25,440,.07,.31,.44,,4.5,5,,,,.08,,15,,,.97,.12,,505]);
const sound_enemy_mutter = new Sound([1.5,-0.25,65.40639,.07,.23,.25,,4.5,5,,,.12,.08,,17.1,,,.97,.18,1,505]);

class Enemy1 extends GameObject
{
    tileOffsets = {awake: 0, sleeping: 1, mad: 2};

    constructor(pos)
    { 
        super(pos, vec2(.9,.9), spriteAtlas['enemy']);

        this.drawSize = vec2(1);
        this.color = hsl(rand(), 1, .7);
        this.health = 5;
        this.swellSpeed = 6;
        this.swellTimer = new Timer(rand(1e3));
        this.setCollision(true, false);
        this.sm = new Enemy1Sm();
        this.sm.vars.obj = this;
        this.spawnPos = pos.copy();
        this.patrolVec = vec2(0.05, 0);
        this.patrolRange = 6;
        this.stallTracker = new StallTracker(this);
        this.tileInfo = tile(6);

        if (rand() < 0.5)
            this.patrolVec.x *= -1;

        this.sm.start();
    }

    useTile(offsetName) {
        const baseTile = spriteAtlas.enemy;
        // this.tileInfo.pos.x = baseTile.pos.x - baseTile.size.x * 1;
        this.tileInfo.pos.x = baseTile.pos.x + baseTile.size.x * this.tileOffsets[offsetName];
        this.tileInfo.textureIndex = 0;
    }

    resetTile() {
        this.useTile('awake');
    }

    playerDist()
    {
        return this.pos.distance(player.pos);
    }

    playHuntSound() {
        sound_enemy_hunting.play(this.pos, .4);
    }

    playCelebrationSound() {
        sound_enemy_laughing.play(this.pos, .4);
    }

    playMutterSound() {
        sound_enemy_mutter.play(this.pos, .4);
    }

    jumpAround()
    {
        // jump around randomly
        if (this.groundObject && rand() < 0.1)
        {
            this.velocity = vec2(rand(.1,-.1), rand(.4, .2));
            sound_jump.play(this.pos, .4, 2);
        }
    }

    isPatrolEnd()
    {
        if (this.stallTracker.stallCount > 5)
            return true;

        // if (this.willHitTile(this.patrolVec))
        //     return true;

        // TODO check if will fall off edge

        const distanceToSpawn = this.pos.distance(this.spawnPos);
        const nextDistanceToSpawn = this.pos.add(this.patrolVec).distance(this.spawnPos);
        const isBeyondPatrolRange = distanceToSpawn >= this.patrolRange;
        const isMovingAwayFromSpawn = nextDistanceToSpawn >= distanceToSpawn;
        return isBeyondPatrolRange && isMovingAwayFromSpawn;
    }

    // this isn't a good solution. it needs to ignore ladders, but take into account boxes and stuff...
    willHitTile(vec)
    {
        // vec = vec.normalize();
        vec = vec.copy();
        vec.x += sign(vec.x) * this.size.x/2;
        const pos = this.pos.add(vec);
        return tileCollisionTest(pos, this.size);
    }

    doPatrolMarch()
    {
        this.velocity.x = this.patrolVec.x;
    }

    patrolTurn()
    {
        this.patrolVec.x *= -1;
    }

    doHuntPlayer()
    {
        const vecToPlayer = this.normVecToPlayer();

        // if in air, drift towards player
        if (!this.groundObject)
        {
            this.velocity.x += vecToPlayer.x * .001;
        }
        else
        {
            const scaledStallCount = this.stallTracker.stallCount / 60 / 2 * 0.1;

            // on ground. randomly jump towards player
            if (rand() < 0.01 + scaledStallCount)
            {
                this.jumpTowardsPlayer(vecToPlayer, scaledStallCount);
            }
            else
            {
                // if not jumping, march towards player
                this.velocity = vecToPlayer.multiply(vec2(.07, .0));
            }
        }
    }

    normVecToPlayer() {
        return player.pos.subtract(this.pos).normalize();
    }

    /**
     * @param {vec2?} vecToPlayer 
     * @param {number} jumpBoost - additional jump speed for when enemy is stuck/stalled
     */
    jumpTowardsPlayer(vecToPlayer, jumpBoost = 0)
    {
        if (!vecToPlayer)
            vecToPlayer = this.normVecToPlayer();

        const jumpYSpeed = clamp(rand(.4, .2) + jumpBoost, 0, 0.4);
        const jumpXSpeed = rand(.07, .2);
        this.velocity = vecToPlayer.multiply(vec2(jumpXSpeed, 0));
        this.velocity.y = jumpYSpeed;
        sound_jump.play(this.pos, .4, 2);
    }

    smallVerticalHop()
    {
        this.velocity.y = .1;
        this.velocity.x = 0;
        sound_jump.play(this.pos, .4, 2);
    }

    damage(damage, damagingObject)
    {
        super.damage(damage, damagingObject);
        this.sm.dispatchEvent(Enemy1Sm.EventId.DAMAGED);

        // if damaged, sometimes jump at player
        if (this.groundObject && rand() < 0.5)
        {
            this.jumpTowardsPlayer();
        }
    }
    
    heardShot(pos)
    {
        this.sm.dispatchEvent(Enemy1Sm.EventId.HEARD_SHOT);
    }

    update()
    {
        super.update();
        
        if (!player)
            return;

        // run state machine
        this.sm.dispatchEvent(Enemy1Sm.EventId.DO);

        // damage player if touching
        if (isOverlapping(this.pos, this.size, player.pos, player.size))
        {
            this.sm.dispatchEvent(Enemy1Sm.EventId.HIT_PLAYER);
            player.damage(1, this);
        }

        // todo performance - only do once when it happens
        if (player.isDead())
        {
            this.sm.dispatchEvent(Enemy1Sm.EventId.PLAYER_DEAD);
        }

        const debugClosest = true;
        if (debugClosest) {
            if (this.playerDist() < 20)
            {
                window.debugEnemy = this;
            }
        }
    }

    kill()
    {
        if (this.destroyed)
            return;

        ++score;
        sound_enemy_hunting.stop(); // doesn't seem to work...
        sound_score.play(this.pos);
        makeDebris(this.pos, this.color);
        this.destroy();
    }
    
    render()
    {
        // bounce by changing size
        const bounceTime = this.swellTimer * this.swellSpeed;
        this.drawSize = vec2(1-.1*Math.sin(bounceTime), 1+.1*Math.sin(bounceTime));

        // make bottom flush
        let bodyPos = this.pos;
        bodyPos = bodyPos.add(vec2(0,(this.drawSize.y-this.size.y)/2));
        drawTile(bodyPos, this.drawSize, this.tileInfo, this.color, this.angle, this.mirror, this.additiveColor);
        debugText(Enemy1Sm.stateIdToString(this.sm.stateId), this.pos.add(vec2(0,1)), 0.5);
        // debugCircle(this.pos, 8, hsl(0, 0, 1, 0.2));
    }
}

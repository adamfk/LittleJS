'use strict';

class StallTracker
{
    stallCount;
    startingPos;

    constructor(gameObject)
    {
        this.gameObject = gameObject;
        this.mask = vec2(1,0); // don't care about y for now

        this.reset();
    }

    /**
     * @param {Vector2?} startingPos
     */
    reset(startingPos)
    {
        this.stallCount = 0;
        this.startingPos = startingPos ?? this.getMaskedPosition(this.gameObject);
    }
    
    getMaskedPosition(gameObject) {
        return gameObject.pos.multiply(this.mask);
    }

    update()
    {
        const pos = this.getMaskedPosition(this.gameObject);
        if (pos.distance(this.startingPos) > 0.01)
        {
            this.reset(pos);
        }
        else
        {
            this.stallCount++;
        }
    }
}



class Enemy1 extends GameObject 
{
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

        if (rand() < 0.5)
            this.patrolVec.x *= -1;

        this.sm.start();
    }

    playerDist()
    {
        return this.pos.distance(player.pos);
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
    }
}

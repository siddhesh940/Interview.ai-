class EligibilityService {
  calculateEligibility(userProfile, drive) {
    if (!userProfile) {
      return { isEligible: false, score: 0, reasons: ['Profile not set up'] };
    }

    const reasons = [];
    let matchScore = 0;
    let totalCriteria = 0;

    // Check batch eligibility
    if (drive.batch) {
      totalCriteria++;
      if (userProfile.batch === drive.batch) {
        matchScore++;
      } else {
        reasons.push(`Batch mismatch: Required ${drive.batch}, you have ${userProfile.batch}`);
      }
    }

    // Check CGPA eligibility
    if (drive.min_cgpa) {
      totalCriteria++;
      if (userProfile.cgpa >= drive.min_cgpa) {
        matchScore++;
      } else {
        reasons.push(`CGPA requirement: ${drive.min_cgpa}, yours is ${userProfile.cgpa}`);
      }
    }

    // Check branch eligibility
    if (drive.branches && drive.branches.length > 0) {
      totalCriteria++;
      const userBranch = userProfile.branch?.toLowerCase() || '';
      const branchMatch = drive.branches.some(branch => 
        branch.toLowerCase().includes(userBranch) ||
        userBranch.includes(branch.toLowerCase()) ||
        this.normalizeBranch(branch) === this.normalizeBranch(userProfile.branch)
      );
      
      if (branchMatch) {
        matchScore++;
      } else {
        reasons.push(`Branch not eligible: Required ${drive.branches.join(', ')}`);
      }
    }

    // Calculate score as percentage
    const score = totalCriteria > 0 ? Math.round((matchScore / totalCriteria) * 100) : 100;
    const isEligible = matchScore === totalCriteria;

    return {
      isEligible,
      score,
      reasons: isEligible ? ['All criteria matched!'] : reasons
    };
  }

  normalizeBranch(branch) {
    if (!branch) {return '';}
    
    const normalizations = {
      'cse': 'computer science',
      'cs': 'computer science',
      'computer science': 'computer science',
      'computer science and engineering': 'computer science',
      'it': 'information technology',
      'information technology': 'information technology',
      'ece': 'electronics and communication',
      'electronics': 'electronics and communication',
      'electronics and communication': 'electronics and communication',
      'eee': 'electrical and electronics',
      'electrical': 'electrical and electronics',
      'me': 'mechanical engineering',
      'mechanical': 'mechanical engineering',
      'civil': 'civil engineering',
      'ce': 'civil engineering'
    };

    const lowerBranch = branch.toLowerCase().trim();
    
return normalizations[lowerBranch] || lowerBranch;
  }

  filterEligibleDrives(userProfile, drives) {
    return drives.map(drive => ({
      ...drive,
      eligibility: this.calculateEligibility(userProfile, drive)
    })).filter(drive => drive.eligibility.isEligible);
  }

  rankDrivesByEligibility(userProfile, drives) {
    return drives.map(drive => ({
      ...drive,
      eligibility: this.calculateEligibility(userProfile, drive)
    })).sort((a, b) => {
      // First by eligibility
      if (a.eligibility.isEligible && !b.eligibility.isEligible) {return -1;}
      if (!a.eligibility.isEligible && b.eligibility.isEligible) {return 1;}
      
      // Then by score
      if (b.eligibility.score !== a.eligibility.score) {
        return b.eligibility.score - a.eligibility.score;
      }
      
      // Then by deadline (closest first)
      return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
    });
  }
}

module.exports = new EligibilityService();
